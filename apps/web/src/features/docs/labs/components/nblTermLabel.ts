const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

export const termLabel = (index: number) =>
  `t${String(index + 1).replace(/\d/g, (digit) => SUBSCRIPTS[Number(digit)])}`;

