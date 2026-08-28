import type {CSSProperties} from "react";

// Faint type-theory symbols drifting in the background — a small nod to what
// this app is about. Animated with a pure-CSS compositor transform (see
// `.tt-symbol` in index.css), not per-frame JS.
// Render inside a `relative overflow-hidden` container.
const FLOATING_SYMBOLS = [
  {char: "λ", top: "14%", left: "9%", size: "text-7xl", dur: 7, delay: 0, drift: 18},
  {char: "∀", top: "68%", left: "6%", size: "text-6xl", dur: 8, delay: 0.5, drift: 14},
  {char: "→", top: "17%", left: "86%", size: "text-8xl", dur: 6.5, delay: 1, drift: 22},
  {char: "Γ", top: "78%", left: "89%", size: "text-6xl", dur: 9, delay: 1.5, drift: 12},
  {char: "⊢", top: "45%", left: "4%", size: "text-5xl", dur: 7.5, delay: 0.8, drift: 16},
  {char: "∃", top: "88%", left: "70%", size: "text-5xl", dur: 8.5, delay: 0.3, drift: 20},
  {char: "λ→", top: "7%", left: "33%", size: "text-5xl", dur: 8, delay: 1.2, drift: 15},
  {char: "λω", top: "27%", left: "72%", size: "text-6xl", dur: 7, delay: 0.2, drift: 19},
  {char: "λF", top: "57%", left: "82%", size: "text-6xl", dur: 9.5, delay: 0.9, drift: 13},
  {char: "λP", top: "86%", left: "19%", size: "text-5xl", dur: 7, delay: 1.4, drift: 17},
  {char: "Λ", top: "12%", left: "73%", size: "text-7xl", dur: 8, delay: 0.6, drift: 21},
  {char: "μ", top: "46%", left: "84%", size: "text-6xl", dur: 10, delay: 0.4, drift: 24},
  {char: "Π", top: "37%", left: "18%", size: "text-6xl", dur: 7.5, delay: 1.1, drift: 15},
  {char: "δ", top: "75%", left: "28%", size: "text-5xl", dur: 8, delay: 0.7, drift: 18},
  {char: "×", top: "22%", left: "26%", size: "text-4xl", dur: 6.5, delay: 1.6, drift: 12},
  {char: "≡", top: "61%", left: "11%", size: "text-4xl", dur: 9, delay: 0.1, drift: 20},
] as const;

export function FloatingLambdaSymbols() {
  return (
    <>
      {FLOATING_SYMBOLS.map((s, i) => (
        <span
          key={i}
          className={`tt-symbol absolute font-serif italic text-foreground/[0.06] select-none pointer-events-none ${s.size}`}
          style={{
            top: s.top,
            left: s.left,
            "--tt-dur": `${s.dur}s`,
            "--tt-delay": `${s.delay}s`,
            "--tt-drift": `${s.drift}px`,
          } as CSSProperties}
        >
          {s.char}
        </span>
      ))}
    </>
  );
}
