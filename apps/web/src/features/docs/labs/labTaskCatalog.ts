// Every task in every lab, read from the lab sources, so progress can be shown against the whole lab
// (including tasks not started yet). Task structure is the same in every translation of a lab.
const sources = import.meta.glob("./content/*/*.mdx", {query: "?raw", import: "default", eager: true}) as Record<string, string>;

export interface LabTaskInfo {
  // The id given in the MDX (`<NblTask id="size" …/>`).
  id: string;
  // The heading the task sits under, e.g. "Úloha 1.3".
  heading: string;
  // How many items the task has: one per term for list tasks, otherwise one.
  items: number;
}

const TASK_COMPONENTS = /<(NblTask|LambdaTask|TypingTask|PredictThenVerify|AstBuilder)\b([\s\S]*?)\/>/g;

function arrayLengths(source: string): Record<string, number> {
  const lengths: Record<string, number> = {};
  for (const match of source.matchAll(/export const (\w+)\s*=\s*\[([\s\S]*?)\n\]/g)) {
    lengths[match[1]] = (match[2].match(/^\s*"(?:\\.|[^"\\])*"\s*,?\s*$/gm) ?? []).length;
  }
  return lengths;
}

function parseLab(source: string): LabTaskInfo[] {
  const lengths = arrayLengths(source);
  const headings = [...source.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => ({at: m.index ?? 0, text: m[1].trim()}));
  const tasks: LabTaskInfo[] = [];
  for (const match of source.matchAll(TASK_COMPONENTS)) {
    const attrs = match[2];
    const id = attrs.match(/\bid="([^"]+)"/)?.[1];
    if (!id) continue;
    const termsName = attrs.match(/\bterms=\{(\w+)\}/)?.[1];
    const heading = headings.filter((h) => h.at < (match.index ?? 0)).at(-1)?.text ?? id;
    tasks.push({id, heading, items: termsName ? lengths[termsName] ?? 1 : 1});
  }
  return tasks;
}

const bySlug = new Map<string, LabTaskInfo[]>();
for (const [path, source] of Object.entries(sources)) {
  if (typeof source !== "string") continue;
  const slug = path.split("/")[2];
  if (!bySlug.has(slug)) bySlug.set(slug, parseLab(source));
}

export const labTasks = (slug: string): LabTaskInfo[] => bySlug.get(slug) ?? [];
