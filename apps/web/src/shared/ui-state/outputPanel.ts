let visibleCount = 0;
let opener: (() => void) | undefined;

export function markOutputVisible(): () => void {
  visibleCount++;
  return () => {
    visibleCount--;
  };
}

export const isOutputVisible = () => visibleCount > 0;

// The active layout (dockview or mobile tabs) registers how to bring the Output panel to front.
export function registerOutputOpener(open: () => void): () => void {
  opener = open;
  return () => {
    if (opener === open) opener = undefined;
  };
}

export const openOutput = () => opener?.();
