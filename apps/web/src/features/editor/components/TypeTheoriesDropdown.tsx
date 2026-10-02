import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Circle, FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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

type Base = "stlc" | "untyped" | "nbl";

function SectionLabel({children}: {children: ReactNode}) {
  return <DropdownMenuLabel className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{children}</DropdownMenuLabel>;
}

// Shows the description of whichever item is focused (Radix focuses items on hover), so rows stay one line.
function DescriptionStrip({text}: {text: string}) {
  return (
    <>
      <DropdownMenuSeparator />
      <p className="min-h-[3.25rem] px-2 py-1.5 text-xs leading-snug text-muted-foreground">{text}</p>
    </>
  );
}

export interface TypeTheoriesDropdownProps {
  disabled?: boolean;
}

export function TypeTheoriesDropdown({disabled = false}: TypeTheoriesDropdownProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);
  const curryHoward = useAppSelector((state) => state.term.curryHoward);
  const stlcFeatures = useAppSelector((state) => state.term.stlcFeatures);
  const base: Base = enabledTheories.untyped ? "untyped" : enabledTheories.nbl ? "nbl" : "stlc";
  const exclusiveTheories = TYPE_THEORIES.filter((theory) => EXCLUSIVE_THEORY_IDS.includes(theory.id));
  const extensions = TYPE_THEORIES.filter((theory) => !EXCLUSIVE_THEORY_IDS.includes(theory.id));
  const addedCount = extensions.filter((theory) => enabledTheories[theory.id]).length + (curryHoward ? 1 : 0);
  const enabledFeatureCount = STLC_FEATURES.filter((feature) => stlcFeatures[feature.id]).length;

  const theoryLabel = (id: TypeTheoryId, fallback: string) => t(`extensions.theories.${id}.label`, fallback);
  const theoryDescription = (id: TypeTheoryId, fallback: string) => t(`extensions.theories.${id}.description`, fallback);
  const baseShortLabel = base === "stlc"
    ? "STLC"
    : t(`extensions.theories.${base}.shortLabel`, exclusiveTheories.find((theory) => theory.id === base)!.shortLabel);

  const [description, setDescription] = useState<string | undefined>();
  const [featureDescription, setFeatureDescription] = useState<string | undefined>();
  const describe = (text: string) => ({onFocus: () => setDescription(text)});
  const stlcDescription = t("extensions.stlcDescription");

  const chooseBase = (next: string) => {
    if (next === "stlc") EXCLUSIVE_THEORY_IDS.forEach((id) => dispatch(setTheoryEnabled({id, enabled: false})));
    else dispatch(setTheoryEnabled({id: next as TypeTheoryId, enabled: true}));
  };

  return (
    <DropdownMenu onOpenChange={(open) => !open && setDescription(undefined)}>
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
          <span className="text-muted-foreground">·</span>
          <span className="font-semibold">{baseShortLabel}</span>
          {addedCount > 0 && <span className="text-xs text-muted-foreground">+{addedCount}</span>}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <SectionLabel>{t("extensions.sections.base")}</SectionLabel>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            inset
            className="relative"
            onClick={() => chooseBase("stlc")}
            {...describe(stlcDescription)}
          >
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
              {base === "stlc" && <Circle className="size-2 fill-current text-foreground" />}
            </span>
            <span className="truncate">{t("extensions.stlcLabel")}</span>
            <span className="ml-auto pl-2 text-[11px] text-muted-foreground">{enabledFeatureCount}/{STLC_FEATURES.length}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            <SectionLabel>{t("extensions.stlcFeatures.trigger")}</SectionLabel>
            {STLC_FEATURES.map((feature) => (
              <DropdownMenuCheckboxItem
                key={feature.id}
                checked={stlcFeatures[feature.id]}
                disabled={base !== "stlc"}
                onSelect={(e) => e.preventDefault()}
                onFocus={() => setFeatureDescription(t(`extensions.stlcFeatures.${feature.id}.description`, feature.description))}
                onCheckedChange={(checked) => dispatch(setStlcFeature({id: feature.id, enabled: checked}))}
              >
                {t(`extensions.stlcFeatures.${feature.id}.label`, feature.label)}
              </DropdownMenuCheckboxItem>
            ))}
            <DescriptionStrip text={featureDescription ?? t("extensions.stlcFeatures.hint")}/>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuRadioGroup value={base} onValueChange={chooseBase}>
          {exclusiveTheories.map((theory) => (
            <DropdownMenuRadioItem
              key={theory.id}
              value={theory.id}
              disabled={curryHoward}
              onSelect={(e) => e.preventDefault()}
              {...describe(theoryDescription(theory.id, theory.description))}
            >
              {theoryLabel(theory.id, theory.label)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <AnimatePresence initial={false}>
          {base === "stlc" && (
            // Extensions and the logic view only exist on top of STLC.
            <motion.div
              key="stlc-sections"
              initial={{height: 0, opacity: 0}}
              animate={{height: "auto", opacity: 1}}
              exit={{height: 0, opacity: 0}}
              transition={{duration: 0.2, ease: "easeOut"}}
              className="overflow-hidden"
            >
              <SectionLabel>{t("extensions.sections.extensions")}</SectionLabel>
              {extensions.map((theory) => (
                <DropdownMenuCheckboxItem
                  key={theory.id}
                  checked={enabledTheories[theory.id]}
                  disabled={curryHoward}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) => dispatch(setTheoryEnabled({id: theory.id, enabled: checked}))}
                  {...describe(theoryDescription(theory.id, theory.description))}
                >
                  {theoryLabel(theory.id, theory.label)}
                </DropdownMenuCheckboxItem>
              ))}

              <SectionLabel>{t("extensions.sections.views")}</SectionLabel>
              <DropdownMenuCheckboxItem
                checked={curryHoward}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) => dispatch(setCurryHoward(checked))}
                {...describe(t("extensions.curryHoward.description"))}
              >
                {t("extensions.curryHoward.label")}
              </DropdownMenuCheckboxItem>
            </motion.div>
          )}
        </AnimatePresence>

        <DescriptionStrip text={description ?? t("extensions.hint")}/>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
