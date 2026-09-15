// Builds one "Complete Guide" PDF per locale that has real translations for every written
// lecture: title page -> table of contents (each lecture, indented with its own top-level
// outline sections, derived from the rendered MDX — see measureOutlinePages/extractOutline.ts,
// not a hand-maintained JSON list) -> every lecture in order -> an "Appendix" divider -> the
// Rules reference page, with continuous page numbers stamped across the whole thing (title page
// excluded) and clickable table-of-contents entries.
//
// Every part except the table of contents is rendered with real headless Chrome, same as
// gen-lecture-pdfs.mjs — no rasterization, see that file's header comment for why. The title
// page is /docs/guide-cover (src/features/docs/guide/cover.mdx) and the appendix divider is
// /docs/guide-appendix-cover (src/pages/docs/DocsGuideAppendixCoverPage.tsx), both printed
// through the exact same pipeline as a lecture, so they get real app styling instead of a
// hand-drawn PDF page; edit the cover MDX file to change the title, subtitle, or authors, or the
// appendix page component to change its layout. The table of contents can't be rendered that
// way — its page numbers depend on every other part's page count, which is only known once
// they've all been printed — so it's drawn directly with pdf-lib instead.
//
// The parts are stitched together with pdf-lib, which works on the real PDF objects (pages,
// fonts, link annotations) rather than images, so external links and page counts survive the
// merge, and internal "jump to this page" links can be added to the table of contents.
//
// Run: node scripts/gen-merged-guide.mjs (expects dist/ to already be built — see package.json)
import {readFileSync, readdirSync, mkdirSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve, join} from "node:path";
import {preview} from "vite";
import {PDFDocument, PDFName, rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {launchBrowser} from "./launchBrowser.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
// Noto Sans, not pdf-lib's built-in Helvetica — the standard PDF fonts only cover WinAnsi
// (Latin-1) and can't encode Cyrillic or several Slovak diacritics (š č ž ľ ť ď ň) at all;
// pdf-lib throws rather than mangling them, so "sk"/"uk" ToC labels would otherwise crash this
// script outright the moment real lecture translations exist for them. Noto Sans is specifically
// designed for broad multi-script coverage — verified it covers both scripts before adding it.
// Resolved via import.meta.resolve rather than a hardcoded node_modules path since npm
// workspaces hoists this devDependency up to the repo root, not apps/web/node_modules.
const NOTO_SANS_REGULAR = fileURLToPath(
  import.meta.resolve("@expo-google-fonts/noto-sans/400Regular/NotoSans_400Regular.ttf"),
);
const NOTO_SANS_BOLD = fileURLToPath(
  import.meta.resolve("@expo-google-fonts/noto-sans/700Bold/NotoSans_700Bold.ttf"),
);
const lecturesDir = join(webRoot, "src/features/docs/lectures");
const SITE_URL = "https://type-theory.dev";
const PRINT_MARGIN_MM = 15;
const PRINT_MARGIN = `${PRINT_MARGIN_MM}mm`;

// Must match SUPPORTED_LANGUAGES in src/i18n/i18n.ts — kept as a plain constant here since this
// script runs under plain Node, outside Vite's TS/JSX pipeline.
const CANDIDATE_LOCALES = ["en", "sk", "uk"];

// The pdf-lib-drawn labels ("Table of Contents", "Appendix", "Rules Reference") come straight
// from the same common.json the live app uses (guide.*) — one source of truth, not a second
// hardcoded translation map to drift out of sync with it. Drawn with the embedded Noto Sans
// fonts above (not pdf-lib's standard fonts), so Cyrillic and Slovak diacritics render fine.
function guideStrings(locale) {
  const common = JSON.parse(readFileSync(join(webRoot, `src/i18n/locales/${locale}/common.json`), "utf8"));
  return common.guide;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 56.7; // 20mm

// The CSS-px box Chrome actually lays content out in while printing (scale 1 => 96 CSS px per
// inch) — used to work out which page, within a lecture's own PDF, a given heading lands on.
const MM_PER_INCH = 25.4;
const CONTENT_WIDTH_PX = Math.round(((210 - PRINT_MARGIN_MM * 2) / MM_PER_INCH) * 96);
const CONTENT_HEIGHT_PX = ((297 - PRINT_MARGIN_MM * 2) / MM_PER_INCH) * 96;

const lecturesConfig = JSON.parse(
  readFileSync(join(webRoot, "src/features/docs/lectures.config.json"), "utf8"),
);
const writtenLectures = lecturesConfig.lectures.filter((l) => l.visible && l.openable);

if (writtenLectures.length === 0) {
  console.log("[gen-merged-guide] no written lectures found, nothing to do");
  process.exit(0);
}

function lectureLocales(slug) {
  return new Set(
    readdirSync(join(lecturesDir, slug)).filter((f) => f.endsWith(".mdx")).map((f) => f.replace(/\.mdx$/, "")),
  );
}

// A locale only gets its own merged guide once every written lecture has a real translation for
// it — a "Complete Guide" that's silently half English isn't worth shipping as its own file.
const locales = CANDIDATE_LOCALES.filter((locale) =>
  writtenLectures.every((l) => lectureLocales(l.slug).has(locale)),
);

if (!locales.includes("en")) {
  console.warn("[gen-merged-guide] no lecture has an en.mdx — skipping (fallback assumption broken)");
  process.exit(0);
}

const server = await preview({root: webRoot, preview: {port: 4173, strictPort: false}});
const baseUrl = server.resolvedUrls.local[0];
const browser = await launchBrowser();
const outDir = join(webRoot, "dist", "lectures-pdf");
const notoSansRegularBytes = readFileSync(NOTO_SANS_REGULAR);
const notoSansBoldBytes = readFileSync(NOTO_SANS_BOLD);

// `onBeforePrint(page)`, if given, runs after the page is fully settled (MathJax typeset, print
// media rewrites applied) but before it's captured — its return value is passed back as `extra`
// alongside the PDF buffer. Used to measure heading positions for the table of contents.
async function printRoute(path, locale, {onBeforePrint} = {}) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((loc) => localStorage.setItem("tt-lang", loc), locale);
  await page.goto(new URL(path, baseUrl).href, {waitUntil: "networkidle0"});
  const title = await page.title();
  if (title === "Lecture not found — tt") {
    throw new Error(
      `${path}: dist/ doesn't know about this route yet — rebuild with \`npm run build:web\` ` +
      `(not this script alone) after editing lecture content.`,
    );
  }
  await page.waitForSelector("mjx-container", {timeout: 10_000}).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
  // Root-relative hrefs ("/docs/rules") would otherwise print as http://localhost:.../docs/rules.
  await page.evaluate((siteUrl) => {
    const base = document.createElement("base");
    base.href = `${siteUrl}/`;
    document.head.prepend(base);
  }, SITE_URL);
  const extra = onBeforePrint ? await onBeforePrint(page) : undefined;
  const buffer = await page.pdf({
    format: "a4",
    printBackground: true,
    margin: {top: PRINT_MARGIN, bottom: PRINT_MARGIN, left: PRINT_MARGIN, right: PRINT_MARGIN},
  });
  await page.close();
  return {buffer, extra};
}

// Finds each top-level outline section (SectionHeading/SummaryBox/ReferenceList — see
// extractOutline.ts, the same data-toc-level markers the live site's on-page TOC uses) and
// which page (1-indexed, within this lecture's own PDF) it lands on, by switching to print
// layout at the same content width/media Chrome prints at and reading each heading's actual
// position. No JSON outline list involved — id, label, and position all come from this one DOM
// query, so a section added to the MDX shows up here automatically. Only level 1 is used (not
// ConceptSection's nested level 2) to keep the merged guide's table of contents concise.
async function measureOutlinePages(page) {
  await page.emulateMediaType("print");
  await page.setViewport({width: CONTENT_WIDTH_PX, height: 1200});
  return page.evaluate((contentHeightPx) => {
    const items = [];
    document.querySelectorAll("[data-toc-level]").forEach((el) => {
      if (el.dataset.tocLevel !== "1" || !el.id || !el.dataset.tocTitle) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      items.push({label: el.dataset.tocTitle, pageWithinLecture: Math.floor(top / contentHeightPx) + 1});
    });
    return items;
  }, CONTENT_HEIGHT_PX);
}

function drawCentered(page, text, {y, size, font, color = rgb(0.1, 0.1, 0.1)}) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {x: (A4_WIDTH - width) / 2, y, size, font, color});
}

// Draws one "Label ..... 12" row with a dotted leader filling the gap, and returns its
// clickable bounding box (for the internal jump-to-page link added once all pages exist).
function drawTocRow(page, label, pageNum, {y, labelFont, numFont, size = 11, indent = 0}) {
  const x = MARGIN + indent;
  page.drawText(label, {x, y, size, font: labelFont, color: rgb(0.15, 0.15, 0.15)});
  const numText = String(pageNum);
  const numWidth = numFont.widthOfTextAtSize(numText, size);
  const numX = A4_WIDTH - MARGIN - numWidth;
  page.drawText(numText, {x: numX, y, size, font: numFont, color: rgb(0.15, 0.15, 0.15)});

  const labelWidth = labelFont.widthOfTextAtSize(label, size);
  const leaderStart = x + labelWidth + 6;
  const leaderEnd = numX - 6;
  if (leaderEnd > leaderStart) {
    page.drawLine({
      start: {x: leaderStart, y: y + size * 0.3},
      end: {x: leaderEnd, y: y + size * 0.3},
      thickness: 0.75,
      color: rgb(0.8, 0.8, 0.8),
      dashArray: [1, 2],
    });
  }

  return {x1: x - 4, y1: y - 5, x2: A4_WIDTH - MARGIN, y2: y + size + 3, targetPageNum: pageNum};
}

// A jump-to-page link, not an external URL — constructed at the PDF-object level since pdf-lib
// has no high-level helper for internal navigation (only for URI links).
function addInternalLink(pdfDoc, page, rect, targetPage) {
  const annotRef = pdfDoc.context.register(
    pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [rect.x1, rect.y1, rect.x2, rect.y2],
      Border: [0, 0, 0],
      Dest: [targetPage.ref, "Fit"],
    }),
  );
  const existingAnnots = page.node.Annots();
  if (existingAnnots) {
    existingAnnots.push(annotRef);
  } else {
    page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annotRef]));
  }
}

try {
  for (const locale of locales) {
    console.log(`[gen-merged-guide] building ${locale}...`);

    const {buffer: coverBuffer} = await printRoute("/docs/guide-cover", locale);
    const coverDoc = await PDFDocument.load(coverBuffer);

    // Render every other part first so each one's page count (and each outline section's page
    // within it) is known before the table of contents is drawn — no need for a "reserve a
    // blank page, go back and fill in numbers later" trick.
    const parts = [];
    for (const lecture of writtenLectures) {
      const {buffer, extra: outlinePages} = await printRoute(`/docs/${lecture.slug}`, locale, {
        onBeforePrint: (page) => measureOutlinePages(page),
      });
      const doc = await PDFDocument.load(buffer);
      parts.push({
        title: lecture.translations[locale].title,
        doc,
        pageCount: doc.getPageCount(),
        outline: outlinePages,
      });
    }
    const {buffer: appendixCoverBuffer} = await printRoute("/docs/guide-appendix-cover", locale);
    const appendixCoverDoc = await PDFDocument.load(appendixCoverBuffer);
    const {buffer: rulesBuffer} = await printRoute("/docs/rules", locale);
    const rulesDoc = await PDFDocument.load(rulesBuffer);

    // Physical 1-indexed page numbers: the cover page(s) first, then one ToC page, then content.
    let cursor = coverDoc.getPageCount() + 2;
    for (const part of parts) {
      part.startPage = cursor;
      part.outline.forEach((section) => {
        section.page = part.startPage + section.pageWithinLecture - 1;
      });
      cursor += part.pageCount;
    }
    const appendixDividerPage = cursor;
    cursor += appendixCoverDoc.getPageCount();
    const rulesStartPage = cursor;
    cursor += rulesDoc.getPageCount();
    const expectedTotalPages = cursor - 1;

    const strings = guideStrings(locale);
    const finalDoc = await PDFDocument.create();
    finalDoc.registerFontkit(fontkit);
    // subset: false (the default) — subsetting garbled several glyphs here (a pdf-lib bug when
    // the same embedded font is reused across many separate drawText calls); full embedding
    // costs a few hundred KB in this one-time build artifact, which isn't worth chasing further.
    const font = await finalDoc.embedFont(notoSansRegularBytes);
    const boldFont = await finalDoc.embedFont(notoSansBoldBytes);

    // --- Cover (prepended, not hand-drawn — see file header) ---
    const copiedCover = await finalDoc.copyPages(coverDoc, coverDoc.getPageIndices());
    copiedCover.forEach((p) => finalDoc.addPage(p));

    // --- Table of contents (assumes everything fits on one page — revisit if the lecture
    // count grows enough that it doesn't) ---
    const tocPage = finalDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    drawCentered(tocPage, strings.tableOfContents, {y: A4_HEIGHT - MARGIN - 20, size: 20, font: boldFont});
    const tocLinks = [];
    let rowY = A4_HEIGHT - MARGIN - 70;
    for (const part of parts) {
      tocLinks.push(drawTocRow(tocPage, part.title, part.startPage, {y: rowY, labelFont: boldFont, numFont: font}));
      rowY -= 22;
      for (const section of part.outline) {
        tocLinks.push(drawTocRow(tocPage, section.label, section.page, {y: rowY, labelFont: font, numFont: font, size: 9.5, indent: 16}));
        rowY -= 17;
      }
      rowY -= 9;
    }
    tocLinks.push(drawTocRow(tocPage, strings.appendix, appendixDividerPage, {y: rowY, labelFont: boldFont, numFont: font}));
    rowY -= 22;
    tocLinks.push(drawTocRow(tocPage, strings.rulesReference, rulesStartPage, {y: rowY, labelFont: font, numFont: font, size: 9.5, indent: 16}));

    // --- Lectures ---
    for (const part of parts) {
      const copied = await finalDoc.copyPages(part.doc, part.doc.getPageIndices());
      copied.forEach((p) => finalDoc.addPage(p));
    }

    // --- Appendix (a real app-styled page, printed the same way as the cover — see
    // DocsGuideAppendixCoverPage.tsx — not hand-drawn text on a blank pdf-lib page) ---
    const copiedAppendixCover = await finalDoc.copyPages(appendixCoverDoc, appendixCoverDoc.getPageIndices());
    copiedAppendixCover.forEach((p) => finalDoc.addPage(p));
    const copiedRules = await finalDoc.copyPages(rulesDoc, rulesDoc.getPageIndices());
    copiedRules.forEach((p) => finalDoc.addPage(p));

    const allPages = finalDoc.getPages();
    if (allPages.length !== expectedTotalPages) {
      throw new Error(`[gen-merged-guide] page-count mismatch: expected ${expectedTotalPages}, got ${allPages.length}`);
    }

    // Every target page now exists as a real PDFPage with a resolvable ref, so the table of
    // contents' internal links can finally be wired up.
    for (const link of tocLinks) {
      addInternalLink(finalDoc, tocPage, link, allPages[link.targetPageNum - 1]);
    }

    // --- Page numbers, every page except the cover ---
    const coverPageCount = coverDoc.getPageCount();
    allPages.forEach((p, i) => {
      if (i < coverPageCount) return;
      const label = `${i + 1} / ${allPages.length}`;
      const width = font.widthOfTextAtSize(label, 9);
      p.drawText(label, {x: (A4_WIDTH - width) / 2, y: 28, size: 9, font, color: rgb(0.6, 0.6, 0.6)});
    });

    const localeDir = join(outDir, locale);
    mkdirSync(localeDir, {recursive: true});
    writeFileSync(join(localeDir, "complete-guide.pdf"), await finalDoc.save());
    console.log(`[gen-merged-guide] wrote ${locale}/complete-guide.pdf (${allPages.length} pages)`);
  }
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
