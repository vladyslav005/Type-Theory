import {BracketInput} from "@/shared/components/BracketInput.tsx";
import {useUndoableText} from "@/shared/hooks/useUndoableText.ts";
import {applyShortcuts} from "@/features/proof-tree/manual/notation.ts";
import {cn} from "@/shared/lib/utils.ts";

// The same editing help as the manual proof-tree and evaluation fields: bracket matching and
// auto-closing, undo/redo, and shortcuts such as \lambda -> λ.
export function TermInput({value, onChange, onSubmit, placeholder, widthClass = "w-full max-w-md"}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  widthClass?: string;
}) {
  const history = useUndoableText(value, onChange);

  return (
    <BracketInput
      value={value}
      onChange={(e) => history.change(applyShortcuts(e.target.value))}
      onKeyDown={(e) => {
        if (history.onKeyDown(e)) return;
        if (e.key === "Enter" && value.trim()) onSubmit?.();
      }}
      placeholder={placeholder}
      spellCheck={false}
      wrapperClassName={widthClass}
      textClassName="px-2 font-mono text-sm"
      className={cn("h-8 rounded border border-input outline-none focus:ring-1 focus:ring-ring")}
    />
  );
}
