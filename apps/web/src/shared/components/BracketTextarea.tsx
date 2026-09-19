import {forwardRef, useImperativeHandle, useRef, useState} from "react";
import type {ReactNode, TextareaHTMLAttributes} from "react";
import {analyzeBrackets} from "@/shared/lib/bracketMatch.ts";
import {cn} from "@/shared/lib/utils.ts";

interface BracketTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> {
  value: string;
  minRows?: number;
  textClassName?: string;
}

// multi-line BracketInput: the mirrored layer sizes the box and the textarea overlays it
export const BracketTextarea = forwardRef<HTMLTextAreaElement, BracketTextareaProps>(function BracketTextarea(
  {value, minRows = 3, textClassName, className, onSelect, onKeyUp, onClick, onFocus, onBlur, ...rest},
  ref,
) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);
  const [caret, setCaret] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);

  const {unmatched, cursor} = analyzeBrackets(value, focused ? caret : null);

  const nodes: ReactNode[] = [];
  let run = "";
  const flush = (key: number) => {
    if (run) nodes.push(<span key={`t${key}`}>{run}</span>);
    run = "";
  };
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const isCursorBracket = cursor?.at === i;
    const isPartner = cursor?.partner === i;
    const bad = unmatched.has(i);
    if (!bad && !isCursorBracket && !isPartner) {
      run += ch;
      continue;
    }
    flush(i);
    nodes.push(
      <span
        key={i}
        className={cn(
          "rounded-sm",
          bad && "bg-red-500/25 text-red-600 dark:text-red-400",
          isCursorBracket && "bg-amber-400/35 ring-1 ring-amber-500/50",
          isPartner && "bg-amber-300/20 ring-1 ring-amber-400/40",
        )}
      >
        {ch}
      </span>,
    );
  }
  flush(value.length);

  return (
    <span className="relative block">
      <span
        aria-hidden
        className={cn("pointer-events-none block whitespace-pre-wrap break-words rounded border border-transparent bg-background text-foreground", textClassName)}
        style={{minHeight: `calc(${minRows} * 1.5em)`}}
      >
        {nodes}
        {/* zero-width space keeps a trailing newline's height */}
        {"​"}
      </span>
      <textarea
        ref={inner}
        value={value}
        {...rest}
        className={cn("absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-foreground", textClassName, className)}
        onSelect={(e) => { setCaret(e.currentTarget.selectionStart); onSelect?.(e); }}
        onKeyUp={(e) => { setCaret(e.currentTarget.selectionStart); onKeyUp?.(e); }}
        onClick={(e) => { setCaret(e.currentTarget.selectionStart); onClick?.(e); }}
        onFocus={(e) => { setFocused(true); setCaret(e.currentTarget.selectionStart); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      />
    </span>
  );
});
