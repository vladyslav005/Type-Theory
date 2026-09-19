import {forwardRef, useEffect, useImperativeHandle, useRef, useState} from "react";
import type {InputHTMLAttributes, ReactNode} from "react";
import {analyzeBrackets} from "@/shared/lib/bracketMatch.ts";
import {cn} from "@/shared/lib/utils.ts";

interface BracketInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value"> {
  value: string;
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
  textClassName?: string;
}

// the input's own text is transparent; a mirrored layer behind it draws the colored brackets
export const BracketInput = forwardRef<HTMLInputElement, BracketInputProps>(function BracketInput(
  {value, wrapperClassName, wrapperStyle, textClassName, className, onSelect, onKeyUp, onClick, onFocus, onBlur, onScroll, ...rest},
  ref,
) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement);
  const [caret, setCaret] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0);

  // wheel/trackpad scrolls overflowing text sideways; a native listener because React's are passive
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      e.stopPropagation();
      el.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      setScrollLeft(el.scrollLeft);
    };
    el.addEventListener("wheel", onWheel, {passive: false});
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const sync = (el: HTMLInputElement) => {
    setCaret(el.selectionStart);
    setScrollLeft(el.scrollLeft);
  };

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
    <span className={cn("relative block", wrapperClassName)} style={wrapperStyle}>
      <span
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded border border-transparent bg-background text-foreground", textClassName)}
      >
        <span className="whitespace-pre" style={{transform: `translateX(${-scrollLeft}px)`}}>{nodes}</span>
      </span>
      <input
        ref={inner}
        value={value}
        {...rest}
        className={cn("relative w-full bg-transparent text-transparent caret-foreground", textClassName, className)}
        onSelect={(e) => { sync(e.currentTarget); onSelect?.(e); }}
        onKeyUp={(e) => { sync(e.currentTarget); onKeyUp?.(e); }}
        onClick={(e) => { sync(e.currentTarget); onClick?.(e); }}
        onScroll={(e) => { setScrollLeft(e.currentTarget.scrollLeft); onScroll?.(e); }}
        onFocus={(e) => { setFocused(true); sync(e.currentTarget); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      />
    </span>
  );
});
