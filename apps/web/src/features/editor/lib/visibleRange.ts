export interface EditorRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

interface TextModel {
  getLineCount(): number;
  getLineContent(line: number): string;
  getLineMaxColumn(line: number): number;
}

// Errors at end of input (e.g. "missing ';' at '<EOF>'") sit past the last character, where Monaco
// renders an empty range — move them onto the last non-blank character before that point.
export function visibleRange(model: TextModel | null | undefined, range: EditorRange): EditorRange {
  if (!model) return range;
  const line = Math.min(range.startLineNumber, model.getLineCount());
  if (range.startLineNumber <= model.getLineCount() && range.startColumn < model.getLineMaxColumn(line)) return range;
  for (let l = line; l >= 1; l--) {
    const text = l === line ? model.getLineContent(l).slice(0, range.startColumn - 1) : model.getLineContent(l);
    const last = text.trimEnd().length;
    if (last > 0) return {startLineNumber: l, startColumn: last, endLineNumber: l, endColumn: last + 1};
  }
  return range;
}
