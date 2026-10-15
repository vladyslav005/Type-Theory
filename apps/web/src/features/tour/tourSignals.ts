// One-off events from widgets whose progress lives in local component state (not Redux).
export type TourSignal =
  | "evalStep" | "evalFinished" | "evalCheck" | "evalInsert" | "evalStepBack"
  | "evalViewerStep" | "evalUnfold" | "latexExport" | "astFromViewer" | "astPasted";

const listeners = new Set<(signal: TourSignal) => void>();

export function signalTour(signal: TourSignal) {
  listeners.forEach((listener) => listener(signal));
}

export function onTourSignal(listener: (signal: TourSignal) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
