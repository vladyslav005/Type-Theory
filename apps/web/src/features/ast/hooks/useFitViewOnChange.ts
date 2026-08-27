import {useEffect, useRef} from "react";
import {useNodesInitialized, useReactFlow} from "@xyflow/react";

// ReactFlow's `fitView` prop only fires on the first mount. This re-fits the viewport
// whenever `token` changes, but waits until the freshly rendered nodes have been measured
// so the fit is computed against real bounds rather than zero-size placeholders.
// Bump `token` in the same render commit that swaps the nodes in, otherwise the effect can
// see the new token while the store still holds the old nodes.
export function useFitViewOnChange(token: unknown): void {
  const nodesInitialized = useNodesInitialized();
  const {fitView} = useReactFlow();
  const seenRef = useRef(token);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (seenRef.current !== token) {
      seenRef.current = token;
      pendingRef.current = true;
    }
    if (pendingRef.current && nodesInitialized) {
      pendingRef.current = false;
      void fitView({duration: 200});
    }
  }, [token, nodesInitialized, fitView]);
}
