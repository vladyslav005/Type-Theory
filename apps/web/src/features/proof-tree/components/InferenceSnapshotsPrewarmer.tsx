import type {ProofTree, TexTree} from "@vladyslav005/tt-core";
import {ProofTreeComponentUsingCss} from "@/features/proof-tree/components/proof-tree-using-css/ProofTreeTex.tsx";
import {TexRefExpansionProvider} from "@/features/proof-tree/components/proof-tree-using-css/TexRefExpansionContext.tsx";

interface InferenceSnapshotsPrewarmerProps {
  snapshots: ProofTree[];
  toTexTree: (proof: ProofTree) => TexTree;
}

// Renders every inference-trace snapshot once, off-screen, the moment stepping turns on — so
// MathJax typesets each step's judgements in the background while the switch/UI settles, instead
// of on the frame you actually step to it (where the un-typeset LaTeX source briefly flashes).
export function InferenceSnapshotsPrewarmer({snapshots, toTexTree}: InferenceSnapshotsPrewarmerProps) {
  return (
    <div
      aria-hidden="true"
      style={{position: "absolute", width: 0, height: 0, overflow: "hidden", visibility: "hidden", pointerEvents: "none"}}
    >
      {snapshots.map((snapshot, i) => (
        <TexRefExpansionProvider key={i}>
          <ProofTreeComponentUsingCss node={toTexTree(snapshot)}/>
        </TexRefExpansionProvider>
      ))}
    </div>
  );
}
