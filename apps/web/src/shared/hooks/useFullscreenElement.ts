import {useEffect, useState} from "react";

// The current native-Fullscreen-API element (or null). While it's active, the browser only
// paints that element's subtree — a Radix portal defaulting to document.body (Popover,
// ContextMenu, ...) silently stops rendering, so portal-based UI must target this element instead.
export function useFullscreenElement(): Element | null {
  const [element, setElement] = useState<Element | null>(
    typeof document !== "undefined" ? document.fullscreenElement : null,
  );

  useEffect(() => {
    const onChange = () => setElement(document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return element;
}
