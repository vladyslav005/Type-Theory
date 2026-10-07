import {useTranslation} from "react-i18next";
import {LimitSettingsPopover} from "@/shared/components/LimitSettingsPopover.tsx";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {
  DEFAULT_EVALUATION_LIMITS,
  EVALUATION_LIMIT_BOUNDS,
  setEvaluationLimits,
  type EvaluationLimitsSetting,
} from "@/shared/ui-state/termSlice.ts";

const KEYS: (keyof EvaluationLimitsSetting)[] = ["maxSteps", "maxTermSize"];

export function EvaluationLimitsSettings() {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const limits = useAppSelector((state) => state.term.evaluationLimits);

  return (
    <LimitSettingsPopover
      title={t("evaluationPanel.limits.title")}
      fields={KEYS.map((key) => {
        const [min, max] = EVALUATION_LIMIT_BOUNDS[key];
        return {
          label: t(`evaluationPanel.limits.${key}`),
          hint: t(`evaluationPanel.limits.${key}Hint`, {default: DEFAULT_EVALUATION_LIMITS[key], min, max}),
          value: limits[key],
          defaultValue: DEFAULT_EVALUATION_LIMITS[key],
          min,
          max,
        };
      })}
      warning={t("evaluationPanel.limits.warning")}
      note={t("evaluationPanel.limits.appliesNext")}
      onApply={([maxSteps, maxTermSize]) => dispatch(setEvaluationLimits({maxSteps, maxTermSize}))}
    />
  );
}
