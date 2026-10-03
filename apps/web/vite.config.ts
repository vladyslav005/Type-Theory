import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from "@tailwindcss/vite";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import path from "node:path";

// The MDX plugin drops the query before matching, so it would also compile `?raw` imports
// (the lab task catalog reads lab sources as text) — leave those to Vite's raw loader.
function rawSafeMdx(plugin: Plugin): Plugin {
  const transform = plugin.transform as (this: unknown, code: string, id: string) => unknown;
  return {
    ...plugin,
    enforce: "pre",
    transform(code, id) {
      if (id.includes("?raw")) return null;
      return transform.call(this, code, id) as ReturnType<NonNullable<Extract<Plugin["transform"], (...args: never[]) => unknown>>>;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Must run before @vitejs/plugin-react-swc so .mdx is already plain JSX by
    // the time that plugin sees it. providerImportSource lets every .mdx file
    // pick up shared component overrides from an <MDXProvider> automatically,
    // with no per-file wiring (see mdxComponents.tsx / DocsLecturePage.tsx).
    // rehypeSlug auto-adds a kebab-case id to every heading (from its text) so
    // a hand-written outline/TOC entry can link straight to it — a lecture
    // author just writes "## Some Heading" and gets a matching #some-heading
    // anchor for free, no manual id bookkeeping in the prose itself.
    rawSafeMdx(mdx({ remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug], providerImportSource: "@mdx-js/react" })),
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: an app deploy doesn't invalidate the cached libraries.
        manualChunks(id) {
          if (id.includes("/packages/core/") || id.includes("/node_modules/antlr4/")) return "tt-core";
          // CSS stays with its importer, or main.tsx's dockview.css would drag dockview's JS onto every page.
          if (!id.includes("/node_modules/") || id.endsWith(".css")) return undefined;
          if (/\/node_modules\/(@xyflow|@dagrejs|d3-[^/]+|classcat)\//.test(id)) return "vendor-flow";
          if (/\/node_modules\/dockview(-core|-react)?\//.test(id)) return "vendor-dockview";
          if (/\/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return "vendor-motion";
          if (/\/node_modules\/(@radix-ui|radix-ui)\//.test(id)) return "vendor-radix";
          if (/\/node_modules\/(i18next[^/]*|react-i18next)\//.test(id)) return "vendor-i18n";
          if (/\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return "vendor-react";
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
