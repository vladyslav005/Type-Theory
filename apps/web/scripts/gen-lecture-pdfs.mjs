// Renders each written lecture to a PDF using real headless Chrome (Page.printToPDF via
// Puppeteer) against the just-built dist/, printing the app's own @media print stylesheet —
// same mechanism as a reader hitting Ctrl+P, just automated and without the dialog. This
// deliberately avoids rasterizing the DOM ourselves (html2canvas-style): that approach was
// tried and reverted after repeatedly breaking on this app's CSS (Tailwind's color-mix()
// outline rule, MathJax's SVG <use>/<defs> glyphs) — a real browser has none of those problems
// because it's not re-implementing CSS/SVG parsing in JS.
//
// One PDF per (slug, locale) that has a real .mdx file. DocsLecturePage.tsx links to the locale
// of the file it actually renders, so every fallback target is covered too.
// Run: node scripts/gen-lecture-pdfs.mjs (expects dist/ to already be built — see package.json)
import {readFileSync, readdirSync, mkdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve, join} from "node:path";
import {preview} from "vite";
import {launchBrowser} from "./launchBrowser.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const lecturesDir = join(webRoot, "src/features/docs/lectures");
const SITE_URL = "https://type-theory.dev";

// Header/footer templates are isolated from the page's own stylesheet (Chrome renders them in
// a separate context), so styling has to be inlined here rather than reusing index.css classes.
// The pageNumber/totalPages classes are magic strings Chrome itself fills in — not app markup.
const HEADER_TEMPLATE = "<span></span>";
const FOOTER_TEMPLATE = `
  <div style="width:100%; font-size:9px; text-align:center; color:#999; font-family:sans-serif;">
    <span class="pageNumber"></span> / <span class="totalPages"></span>
  </div>
`;

const lecturesConfig = JSON.parse(
  readFileSync(join(webRoot, "src/features/docs/lectures.config.json"), "utf8"),
);
const writtenSlugs = new Set(
  lecturesConfig.lectures.filter((l) => l.visible && l.openable).map((l) => l.slug),
);

const jobs = [];
for (const slug of writtenSlugs) {
  const localeFiles = readdirSync(join(lecturesDir, slug)).filter((f) => f.endsWith(".mdx"));
  const locales = new Set(localeFiles.map((f) => f.replace(/\.mdx$/, "")));
  for (const locale of locales) jobs.push({slug, locale});
}

if (jobs.length === 0) {
  console.log("[gen-lecture-pdfs] no written lectures found, nothing to do");
  process.exit(0);
}

const server = await preview({root: webRoot, preview: {port: 4173, strictPort: false}});
const baseUrl = server.resolvedUrls.local[0];

const browser = await launchBrowser();
const outDir = join(webRoot, "dist", "lectures-pdf");

try {
  for (const {slug, locale} of jobs) {
    const page = await browser.newPage();
    // i18next reads this key (LANGUAGE_STORAGE_KEY in i18n.ts) before its own init runs.
    await page.evaluateOnNewDocument((loc) => localStorage.setItem("tt-lang", loc), locale);
    await page.goto(new URL(`/docs/${slug}`, baseUrl).href, {waitUntil: "networkidle0"});

    // Catches a real failure mode: dist/ built before this lecture was added to
    // lectures.config.json (or before its .mdx file existed) silently renders the app's
    // "Lecture not found" page instead of the lecture — which would otherwise get saved as a
    // valid-looking PDF with no error at all. Run `npm run build:web` (not this script alone)
    // whenever source content changes.
    const title = await page.title();
    if (title === "Lecture not found — tt") {
      throw new Error(
        `${slug}: dist/ doesn't know about this lecture yet — rebuild with \`npm run build:web\` ` +
        `(not \`gen:lecture-pdfs\` alone) after editing lectures.config.json or adding a .mdx file.`,
      );
    }

    await page.waitForSelector("mjx-container", {timeout: 10_000}).catch(() => {});
    // Individual <MathJax> components typeset independently after mount — networkidle plus
    // the first mjx-container doesn't guarantee the rest (usually many small inline formulas
    // per page) have finished; this margin is cheap and avoids a flaky per-node readiness check.
    await new Promise((r) => setTimeout(r, 500));

    // We render against the local preview server, so root-relative hrefs ("/docs/rules")
    // would otherwise print as http://localhost:.../docs/rules — dead links once downloaded.
    // Adding a <base> now (after everything's already loaded from localhost) only affects how
    // the print engine resolves those hrefs, not any further asset fetches.
    await page.evaluate((siteUrl) => {
      const base = document.createElement("base");
      base.href = `${siteUrl}/`;
      document.head.prepend(base);
    }, SITE_URL);

    const localeDir = join(outDir, locale);
    mkdirSync(localeDir, {recursive: true});
    await page.pdf({
      path: join(localeDir, `${slug}.pdf`),
      format: "a4",
      printBackground: true,
      margin: {top: "15mm", bottom: "18mm", left: "15mm", right: "15mm"},
      displayHeaderFooter: true,
      headerTemplate: HEADER_TEMPLATE,
      footerTemplate: FOOTER_TEMPLATE,
    });
    await page.close();
    console.log(`[gen-lecture-pdfs] wrote ${locale}/${slug}.pdf`);
  }
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
