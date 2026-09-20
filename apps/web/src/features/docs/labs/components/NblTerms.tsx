import {termLabel} from "@/features/docs/labs/components/nblTermLabel.ts";

export function NblTerms({terms}: {terms: string[]}) {
  return (
    <ul className="space-y-1.5 rounded-xl border bg-muted/10 p-4 font-mono text-sm list-none">
      {terms.map((term, i) => (
        <li key={i} className="flex gap-3">
          <span className="w-6 shrink-0 text-muted-foreground">{termLabel(i)}</span>
          <span className="min-w-0 break-words">{term}</span>
        </li>
      ))}
    </ul>
  );
}
