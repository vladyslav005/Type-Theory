import {Fragment} from "react";
import type {TexTree} from "@vladyslav005/tt-core";
import type {SourcePosition} from "@vladyslav005/tt-core";
import {Conclusion} from "@/features/proof-tree/components/proof-tree-using-css/Conclusion.tsx";
import {useStepBuild} from "@/features/proof-tree/components/proof-tree-using-css/StepBuildContext.tsx";
import {useTexRefExpansion} from "@/features/proof-tree/components/proof-tree-using-css/TexRefExpansionContext.tsx";
import {cn} from "@/shared/lib/utils.ts";
import "./ProofTree.css"

interface ProofTreeUsingCssProps {
  node: TexTree,
  root?: boolean,
  onNodeHover?: (pos: SourcePosition | null) => void,
  // Node ids whose resolved type just changed, while stepping through an inference trace —
  // rendered with an emphasis style so the resolving type is visually obvious, not just narrated.
  highlightedNodeIds?: ReadonlySet<string>,
}

export function ProofTreeComponentUsingCss(
  {
    node,
    root = true,
    onNodeHover,
    highlightedNodeIds,
  }: ProofTreeUsingCssProps,) {
  const isDef = node.rule === "T-Def" || node.rule === "CT-Def" || node.rule === "Lemma";
  // Shared (not local) so the LaTeX export can snapshot which T-Def/CT-Def/Lemma
  // nodes are currently expanded — see TexRefExpansionContext.
  const {isExpanded, toggle} = useTexRefExpansion();
  const defKey = `def:${node.id ?? ""}`;
  const expanded = isExpanded(defKey);
  const {isRevealed} = useStepBuild();
  const revealed = isRevealed(node);

  const showCollapsedAsVar = isDef && !expanded && node.collapsedChildren !== undefined;
  const displayRule = showCollapsedAsVar ? (node.collapsedRule ?? node.rule) : node.rule;
  const displayChildren = showCollapsedAsVar ? node.collapsedChildren : node.children;

  const isItRoot = root ? "root" : "not-root";
  const isItLeaf = node.children === undefined ? 'leaf-node' : 'not-leaf-node';

  const showPremises = displayChildren !== undefined && (!isDef || expanded || showCollapsedAsVar);
  const isHighlighted = node.id !== undefined && highlightedNodeIds?.has(node.id);

  return (
    <div className='proof-node'>
      {showPremises && (
        <div className={`premises`}>
          {displayChildren!.map((premise, index) => (
            <Fragment key={`${premise.id}-${index}`}>
              <ProofTreeComponentUsingCss
                root={false}
                node={premise}
                onNodeHover={onNodeHover}
                highlightedNodeIds={highlightedNodeIds}/>
              {displayChildren !== undefined && index !== displayChildren.length - 1 && (
                <div className="inter-proof"></div>
              )}
            </Fragment>
          ))}
        </div>
      )}
      <div
        className={cn(`conclusion ${isItRoot} ${isItLeaf}`, !revealed && "step-pending", isHighlighted && "inference-active")}
        onMouseEnter={() => onNodeHover?.(node.pos ?? null)}
        onMouseLeave={() => onNodeHover?.(null)}
      >
        <div className="conclusion-left">
        </div>

        <Conclusion
          node={node}
          isItRoot={isItRoot}
          isItLeaf={isItLeaf}
          isDef={isDef}
          isExpanded={expanded}
          onToggle={() => toggle(defKey)}
        />

        <div className="conclusion-right">
          <p className="rule-name" title={node.ruleTooltip}>{displayRule?.replaceAll('-', ' – ')}</p>
        </div>
      </div>
    </div>
  );
}
