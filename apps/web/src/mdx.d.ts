// tsconfig.app.json's "types" array is an explicit allowlist (just vite/client), so the
// @types/mdx package pulled in transitively by @mdx-js/rollup isn't auto-included — declare
// the module shape ourselves instead of depending on that.
declare module "*.mdx" {
  import type { ComponentType } from "react";

  const MDXContent: ComponentType<Record<string, unknown>>;
  export default MDXContent;
}
