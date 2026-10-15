let visibleCount = 0;
let opener: ((panel: WorkspacePanelId) => void) | undefined;

export type WorkspacePanelId = "editor" | "errorOutput" | "evaluation" | "proofTree" | "ast";

export function markOutputVisible(): () => void {
  visibleCount++;
  return () => {
    visibleCount--;
  };
}

export const isOutputVisible = () => visibleCount > 0;

// The active layout (dockview or mobile tabs) registers how to bring a panel to front.
export function registerPanelOpener(open: (panel: WorkspacePanelId) => void): () => void {
  opener = open;
  return () => {
    if (opener === open) opener = undefined;
  };
}

export const openPanel = (panel: WorkspacePanelId) => opener?.(panel);

export const openOutput = () => openPanel("errorOutput");
