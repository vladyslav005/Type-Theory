// Asserts every locale has exactly the same set of keys as the source (en/common.json).
// Run: node scripts/check-i18n.mjs
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(here, "../src/i18n/locales");
const SOURCE = "en";
const TARGETS = ["sk", "uk"];

// Plural keys legitimately differ per language (en: one/other, sk & uk: one/few/many/other),
// so compare on the base key, ignoring the CLDR plural suffix.
const stripPlural = (k) => k.replace(/_(zero|one|two|few|many|other)$/, "");

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? flatten(v, `${prefix}${k}.`)
      : [stripPlural(`${prefix}${k}`)],
  );

const load = (lng) => JSON.parse(readFileSync(`${localesDir}/${lng}/common.json`, "utf8"));

const sourceKeys = new Set(flatten(load(SOURCE)));
let failed = false;

for (const lng of TARGETS) {
  const keys = new Set(flatten(load(lng)));
  const missing = [...sourceKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !sourceKeys.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n${lng}/common.json:`);
    missing.forEach((k) => console.error(`  missing: ${k}`));
    extra.forEach((k) => console.error(`  extra:   ${k}`));
  }
}

if (failed) process.exit(1);
console.log(`i18n: all locales match ${SOURCE} (${sourceKeys.size} keys)`);
