// Generates public/sitemap.xml from the actual routes that have crawlable content.
// Lecture slugs come from lectures.config.json (visible + openable) so hidden or
// not-yet-written lectures never end up in the sitemap. Run: node scripts/gen-sitemap.mjs
import {readFileSync, writeFileSync} from "node:fs";
import {execSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SITE_URL = "https://type-theory.dev";

// Content routes only — /main is the interactive app (no crawlable text, stays out).
const STATIC_ROUTES = ["/", "/docs", "/docs/rules", "/docs/grammar"];

const lecturesConfig = JSON.parse(
  readFileSync(resolve(here, "../src/features/docs/lectures.config.json"), "utf8"),
);
const writtenLectures = lecturesConfig.lectures
  .filter((lecture) => lecture.visible && lecture.openable)
  .map((lecture) => lecture.slug);

const lastmod = (() => {
  try {
    return execSync("git log -1 --format=%cs", {cwd: here}).toString().trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
})();

const urls = [
  ...STATIC_ROUTES,
  ...writtenLectures.map((slug) => `/docs/${slug}`),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((path) => `  <url>\n    <loc>${SITE_URL}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
  .join("\n")}
</urlset>
`;

writeFileSync(resolve(here, "../public/sitemap.xml"), xml);
console.log(`sitemap: ${urls.length} urls, lastmod ${lastmod}`);
