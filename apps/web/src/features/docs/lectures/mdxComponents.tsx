import type {ComponentPropsWithoutRef} from "react";

// Styles the plain Markdown elements a lecture author writes (headings, paragraphs, lists,
// code, tables) to match the app's existing lecture look — see LectureBlocks.tsx for the same
// conventions (scroll-mt-24 for anchor offset under the fixed top bar, muted-foreground body
// text). Custom blocks (Callout, GrammarBox, TryItBox, ...) stay explicit component tags an
// author imports and uses directly — not implicit mappings from raw Markdown syntax — so
// rendered output stays predictable for a non-developer author.
export const mdxComponents = {
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2 className="scroll-mt-24 text-2xl font-bold mt-10 first:mt-0" {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="scroll-mt-24 text-lg font-semibold mt-6" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="text-sm text-muted-foreground leading-relaxed" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground leading-relaxed" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground leading-relaxed" {...props} />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => <li {...props} />,
  a: (props: ComponentPropsWithoutRef<"a">) => (
    <a className="text-primary underline underline-offset-2 hover:no-underline" {...props} />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]" {...props} />
  ),
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre className="rounded-xl border bg-muted/40 p-4 overflow-x-auto text-sm [&>code]:bg-transparent [&>code]:p-0" {...props} />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote className="border-l-2 border-primary/30 pl-4 italic text-sm text-muted-foreground" {...props} />
  ),
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse" {...props} />
    </div>
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th className="border-b px-3 py-2 text-left font-semibold" {...props} />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => <td className="border-b px-3 py-2 align-top" {...props} />,
};
