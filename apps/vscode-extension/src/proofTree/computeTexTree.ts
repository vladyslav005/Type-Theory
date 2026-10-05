import { InferProofTree, isPlainStlc, LogicMapper, NonStlcProofError, TexMapper, TexTree, Type, TypeTheoryConfig } from "@vladyslav005/tt-core";

export interface TexTreeResult {
	texTree: TexTree;
	effectiveMode: "derivation" | "logic";
	logicAvailable: boolean;
}

// Shared by the Proof Tree panel and the LaTeX export command — both need to pick between
// TexMapper (automatic derivation) and LogicMapper (Curry-Howard), with the same fallback
// when the requested mode isn't applicable to this proof.
export function computeTexTree(
	proof: InferProofTree,
	theories: TypeTheoryConfig,
	typeAliases: { [name: string]: Type } | undefined,
	mode: "derivation" | "logic",
): TexTreeResult {
	const logicAvailable = isPlainStlc(theories);
	const effectiveMode = mode === "logic" && !logicAvailable ? "derivation" : mode;

	try {
		const mapper = effectiveMode === "logic" ? new LogicMapper() : new TexMapper();
		mapper.setTypeAliases(typeAliases ?? {});
		if (mapper instanceof TexMapper) mapper.setNblRuleNames(theories.typedNbl);
		return { texTree: mapper.visit(proof), effectiveMode, logicAvailable };
	} catch (error) {
		if (error instanceof NonStlcProofError) {
			const fallback = new TexMapper();
			fallback.setTypeAliases(typeAliases ?? {});
			fallback.setNblRuleNames(theories.typedNbl);
			return { texTree: fallback.visit(proof), effectiveMode: "derivation", logicAvailable };
		}
		throw error;
	}
}
