import {useDependencies} from "@/app/providers/di/DependencyProvider.tsx";
import type {ProofTree} from "@vladyslav005/tt-core";
import type {TexTree} from "@vladyslav005/tt-core";
import {useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {NonStlcProofError} from "@vladyslav005/tt-core";


export function useProofHooks() {
  const {texMapper, logicMapper} = useDependencies();
  const typeAliases = useAppSelector((state) => state.term.typeAliases);
  const typedNbl = useAppSelector((state) => state.term.enabledTheories.typedNbl);

  function toTexTree(proof: ProofTree): TexTree {
    texMapper.setTypeAliases(typeAliases);
    texMapper.setNblRuleNames(typedNbl);
    return texMapper.visit(proof);
  }

  // Returns null (rather than a mismatched tree) when `proof` uses rules outside plain STLC.
  function toLogicTree(proof: ProofTree): TexTree | null {
    logicMapper.setTypeAliases(typeAliases);
    try {
      return logicMapper.visit(proof);
    } catch (error) {
      if (error instanceof NonStlcProofError) return null;
      throw error;
    }
  }

  return {toTexTree, toLogicTree}
}