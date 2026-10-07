import {useTranslation} from "react-i18next";
import {LimitSettingsPopover} from "@/shared/components/LimitSettingsPopover.tsx";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {DEFAULT_PROOF_TREE_RENDER_LIMIT, PROOF_TREE_RENDER_LIMIT_BOUNDS, setProofTreeRenderLimit} from "@/shared/ui-state/termSlice.ts";

export function ProofTreeLimitSettings() {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const limit = useAppSelector((state) => state.term.proofTreeRenderLimit);
  const [min, max] = PROOF_TREE_RENDER_LIMIT_BOUNDS;
  return (
    <LimitSettingsPopover
      title={t("proofTree.renderGuard.settingsTitle")}
      fields={[{
        label: t("proofTree.renderGuard.limit"),
        hint: t("proofTree.renderGuard.limitHint", {default: DEFAULT_PROOF_TREE_RENDER_LIMIT, min, max}),
        value: limit,
        defaultValue: DEFAULT_PROOF_TREE_RENDER_LIMIT,
        min,
        max,
      }]}
      warning={t("proofTree.renderGuard.warning")}
      onApply={([value]) => dispatch(setProofTreeRenderLimit(value))}
    />
  );
}
