// Builds one "Complete Guide" PDF per locale that has real translations for every written
// lecture: title page -> table of contents -> every lecture in order -> an "Appendix" divider
// -> the Rules and Grammar & Symbols reference pages, with continuous page numbers stamped
// across the whole thing (title page excluded) and clickable table-of-contents entries.
//
// Every part except the table of contents is rendered with real headless Chrome, same as
// gen-lecture-pdfs.mjs — no rasterization, see that file's header comment for why. The title
// page is /docs/guide-cover (src/features/docs/guide/cover.mdx) printed through the exact same
// pipeline as a lecture, so it gets real app styling instead of a hand-drawn PDF page; edit that
// MDX file to change the title, subtitle, or authors. The table of contents can't be rendered
// that way — its page numbers depend on every other part's page count, which is only known once
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
import puppeteer from "puppeteer";
import {preview} from "vite";
import {PDFDocument, StandardFonts, PDFName, rgb} from "pdf-lib";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const lecturesDir = join(webRoot, "src/features/docs/lectures");
const SITE_URL = "https://type-theory.dev";
const PRINT_MARGIN = "15mm";

// Must match SUPPORTED_LANGUAGES in src/i18n/i18n.ts — kept as a plain constant here since this
// script runs under plain Node, outside Vite's TS/JSX pipeline.
const CANDIDATE_LOCALES = ["en", "sk", "uk"];

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 56.7; // 20mm

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
const browser = await puppeteer.launch({args: ["--no-sandbox", "--disable-setuid-sandbox"]});
const outDir = join(webRoot, "dist", "lectures-pdf");

async function printRoute(path, locale) {
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
  const buffer = await page.pdf({
    format: "a4",
    printBackground: true,
    margin: {top: PRINT_MARGIN, bottom: PRINT_MARGIN, left: PRINT_MARGIN, right: PRINT_MARGIN},
  });
  await page.close();
  return buffer;
}

function drawCentered(page, text, {y, size, font, color = rgb(0.1, 0.1, 0.1)}) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {x: (A4_WIDTH - width) / 2, y, size, font, color});
}

// Draws one "Label ..... 12" row with a dotted leader filling the gap, and returns its
// clickable bounding box (for the internal jump-to-page link added once all pages exist).
function drawTocRow(page, label, pageNum, {y, labelFont, numFont, size = 11}) {
  page.drawText(label, {x: MARGIN, y, size, font: labelFont, color: rgb(0.15, 0.15, 0.15)});
  const numText = String(pageNum);
  const numWidth = numFont.widthOfTextAtSize(numText, size);
  const numX = A4_WIDTH - MARGIN - numWidth;
  page.drawText(numText, {x: numX, y, size, font: numFont, color: rgb(0.15, 0.15, 0.15)});

  const labelWidth = labelFont.widthOfTextAtSize(label, size);
  const leaderStart = MARGIN + labelWidth + 6;
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

  return {x1: MARGIN - 4, y1: y - 5, x2: A4_WIDTH - MARGIN, y2: y + size + 3, targetPageNum: pageNum};
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

    const coverDoc = await PDFDocument.load(await printRoute("/docs/guide-cover", locale));

    // Render every other part first so each one's page count is known before the table of
    // contents is drawn — no need for a "reserve a blank page, go back and fill in numbers
    // later" trick.
    const parts = [];
    for (const lecture of writtenLectures) {
      const buffer = await printRoute(`/docs/${lecture.slug}`, locale);
      const doc = await PDFDocument.load(buffer);
      parts.push({title: lecture.translations[locale].title, doc, pageCount: doc.getPageCount()});
    }
    const rulesDoc = await PDFDocument.load(await printRoute("/docs/rules", locale));
    const grammarDoc = await PDFDocument.load(await printRoute("/docs/grammar", locale));

    // Physical 1-indexed page numbers: the cover page(s) first, then one ToC page, then content.
    let cursor = coverDoc.getPageCount() + 2;
    for (const part of parts) {
      part.startPage = cursor;
      cursor += part.pageCount;
    }
    const appendixDividerPage = cursor;
    cursor += 1;
    const rulesStartPage = cursor;
    cursor += rulesDoc.getPageCount();
    const grammarStartPage = cursor;
    cursor += grammarDoc.getPageCount();
    const expectedTotalPages = cursor - 1;

    const finalDoc = await PDFDocument.create();
    const font = await finalDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await finalDoc.embedFont(StandardFonts.HelveticaBold);

    // --- Cover (prepended, not hand-drawn — see file header) ---
    const copiedCover = await finalDoc.copyPages(coverDoc, coverDoc.getPageIndices());
    copiedCover.forEach((p) => finalDoc.addPage(p));

    // --- Table of contents (assumes everything fits on one page — revisit if the lecture
    // count grows enough that it doesn't) ---
    const tocPage = finalDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    drawCentered(tocPage, "Table of Contents", {y: A4_HEIGHT - MARGIN - 20, size: 20, font: boldFont});
    const tocLinks = [];
    let rowY = A4_HEIGHT - MARGIN - 70;
    for (const part of parts) {
      tocLinks.push(drawTocRow(tocPage, part.title, part.startPage, {y: rowY, labelFont: font, numFont: font}));
      rowY -= 26;
    }
    rowY -= 14;
    tocLinks.push(drawTocRow(tocPage, "Appendix", appendixDividerPage, {y: rowY, labelFont: boldFont, numFont: font}));
    rowY -= 26;
    tocLinks.push(drawTocRow(tocPage, "   Rules Reference", rulesStartPage, {y: rowY, labelFont: font, numFont: font}));
    rowY -= 26;
    tocLinks.push(drawTocRow(tocPage, "   Grammar & Symbols", grammarStartPage, {y: rowY, labelFont: font, numFont: font}));

    // --- Lectures ---
    for (const part of parts) {
      const copied = await finalDoc.copyPages(part.doc, part.doc.getPageIndices());
      copied.forEach((p) => finalDoc.addPage(p));
    }

    // --- Appendix ---
    const dividerPage = finalDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    drawCentered(dividerPage, "Appendix", {y: A4_HEIGHT / 2, size: 26, font: boldFont});
    for (const doc of [rulesDoc, grammarDoc]) {
      const copied = await finalDoc.copyPages(doc, doc.getPageIndices());
      copied.forEach((p) => finalDoc.addPage(p));
    }

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
