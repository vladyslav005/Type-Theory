import {useEffect} from "react";
import {useLocation} from "react-router-dom";

export const SITE_URL = "https://type-theory.dev";

export const DEFAULT_META_DESCRIPTION =
  "Write lambda calculus terms and interactively explore parsing, type checking, evaluation, and the " +
  "Curry–Howard correspondence — with AST, proof tree, and evaluation visualizations, plus guided " +
  "lectures on type theory.";

const STRUCTURED_DATA_ID = "page-structured-data";
const ROBOTS_META_ID = "page-robots";

export interface PageMetaOptions {
  // Emit <meta name="robots" content="noindex, follow"> — for routes that exist but
  // shouldn't be in the index (e.g. an unwritten lecture's placeholder).
  noindex?: boolean;
}

// This is a single-page-app with one index.html, so without this every route would share
// the same <title>/description/canonical — set them per page here instead. `structuredData`
// is optional JSON-LD (e.g. a TechArticle for a lecture) rendered into its own <script> tag,
// separate from the site-wide WebSite/SoftwareApplication block that's static in index.html.
export function usePageMeta(
  title: string,
  description: string = DEFAULT_META_DESCRIPTION,
  structuredData?: Record<string, unknown>,
  options: PageMetaOptions = {},
) {
  const {pathname} = useLocation();
  const {noindex = false} = options;

  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${SITE_URL}${pathname}`;

    let robots = document.getElementById(ROBOTS_META_ID) as HTMLMetaElement | null;
    if (noindex) {
      if (!robots) {
        robots = document.createElement("meta");
        robots.id = ROBOTS_META_ID;
        robots.name = "robots";
        document.head.appendChild(robots);
      }
      robots.content = "noindex, follow";
    } else {
      robots?.remove();
    }

    let script = document.getElementById(STRUCTURED_DATA_ID) as HTMLScriptElement | null;
    if (structuredData) {
      if (!script) {
        script = document.createElement("script");
        script.id = STRUCTURED_DATA_ID;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(structuredData);
    } else {
      script?.remove();
    }
  }, [title, description, pathname, structuredData, noindex]);
}
