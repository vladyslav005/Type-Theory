import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from "@tailwindcss/vite";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import path from "node:path";

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
    {
      enforce: "pre",
      ...mdx({ remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug], providerImportSource: "@mdx-js/react" }),
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
