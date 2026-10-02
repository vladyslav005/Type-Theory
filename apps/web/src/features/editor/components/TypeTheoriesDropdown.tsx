import { Check, ChevronDown, FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { STLC_FEATURES, TYPE_THEORIES, type TypeTheoryId } from "@vladyslav005/tt-core";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks.ts";
import { setCurryHoward, setStlcFeature, setTheoryEnabled } from "@/shared/ui-state/termSlice.ts";

const EXCLUSIVE_THEORY_IDS: TypeTheoryId[] = ["untyped", "nbl"];

export interface TypeTheoriesDropdownProps {
  disabled?: boolean;
}

export function TypeTheoriesDropdown({disabled = false}: TypeTheoriesDropdownProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);
  const exclusiveOn = enabledTheories.untyped || enabledTheories.nbl;
  const curryHoward = useAppSelector((state) => state.term.curryHoward);
  const stlcFeatures = useAppSelector((state) => state.term.stlcFeatures);
  const baseTheories = TYPE_THEORIES.filter((theory) => EXCLUSIVE_THEORY_IDS.includes(theory.id));
  const composableTheories = TYPE_THEORIES.filter((theory) => !EXCLUSIVE_THEORY_IDS.includes(theory.id));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          title={disabled ? t("topbar.onlyOnEditor") : undefined}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          {t("extensions.trigger")}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem]">
        <DropdownMenuLabel>{t("extensions.heading")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            inset
            className="relative"
            onClick={() => exclusiveOn && EXCLUSIVE_THEORY_IDS.forEach((id) => dispatch(setTheoryEnabled({ id, enabled: false })))}
          >
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
              {!exclusiveOn && <Check className="size-4 text-foreground" />}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t("extensions.stlcLabel")}</span>
              <span className="text-[13px] leading-snug text-muted-foreground">{t("extensions.stlcDescription")}</span>
            </div>
            <span className="ml-auto pl-2 text-[11px] text-muted-foreground" title={t("extensions.stlcFeatures.trigger")}>
              {STLC_FEATURES.filter((feature) => stlcFeatures[feature.id]).length}/{STLC_FEATURES.length}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            {STLC_FEATURES.map((feature) => (
              <DropdownMenuCheckboxItem
                key={feature.id}
                checked={stlcFeatures[feature.id]}
                disabled={exclusiveOn}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) => dispatch(setStlcFeature({id: feature.id, enabled: checked}))}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{t(`extensions.stlcFeatures.${feature.id}.label`, feature.label)}</span>
                  <span className="text-[13px] leading-snug text-muted-foreground">{t(`extensions.stlcFeatures.${feature.id}.description`, feature.description)}</span>
                </div>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {baseTheories.map((theory) => (
          <DropdownMenuCheckboxItem
            key={theory.id}
            checked={enabledTheories[theory.id]}
            disabled={enabledTheories[theory.id] || curryHoward}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => dispatch(setTheoryEnabled({ id: theory.id, enabled: checked }))}
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t(`extensions.theories.${theory.id}.label`, theory.label)}</span>
              <span className="text-[13px] leading-snug text-muted-foreground">{t(`extensions.theories.${theory.id}.description`, theory.description)}</span>
            </div>
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />

        {composableTheories.map((theory) => (
          <DropdownMenuCheckboxItem
            key={theory.id}
            checked={enabledTheories[theory.id]}
            disabled={curryHoward}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => {
              dispatch(setTheoryEnabled({ id: theory.id, enabled: checked }));
            }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t(`extensions.theories.${theory.id}.label`, theory.label)}</span>
              <span className="text-[13px] leading-snug text-muted-foreground">{t(`extensions.theories.${theory.id}.description`, theory.description)}</span>
            </div>
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={curryHoward}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={(checked) => dispatch(setCurryHoward(checked))}
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{t("extensions.curryHoward.label")}</span>
            <span className="text-[13px] leading-snug text-muted-foreground">{t("extensions.curryHoward.description")}</span>
          </div>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
