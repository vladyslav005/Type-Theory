import type {TocItem} from "@/features/docs/lectures/blocks/LectureBlocks.tsx";

// Derives the on-page/PDF table of contents directly from the rendered lecture DOM instead of
// a hand-maintained duplicate list in lectures.config.json. SectionHeading, ConceptSection,
// SummaryBox, and ReferenceList each mark themselves with data-toc-level ("1" or "2") and
// data-toc-title whenever they're given an id — see LectureBlocks.tsx — so adding a section to
// the MDX shows up here automatically, with nothing else to keep in sync.
export function extractOutline(container: ParentNode): TocItem[] {
  const items: TocItem[] = [];

  container.querySelectorAll<HTMLElement>("[data-toc-level]").forEach((el) => {
    const id = el.id;
    const label = el.dataset.tocTitle;
    if (!id || !label) return;

    if (el.dataset.tocLevel === "2" && items.length > 0) {
      const parent = items[items.length - 1];
      parent.subitems = [...(parent.subitems ?? []), {id, label}];
    } else {
      items.push({id, label});
    }
  });

  return items;
}
