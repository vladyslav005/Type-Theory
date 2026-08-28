import { ChevronDown, FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { TYPE_THEORIES } from "@vladyslav005/tt-core";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks.ts";
import { setTheoryEnabled } from "@/shared/ui-state/termSlice.ts";

export interface TypeTheoriesDropdownProps {
  disabled?: boolean;
}

export function TypeTheoriesDropdown({disabled = false}: TypeTheoriesDropdownProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);

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

        <DropdownMenuCheckboxItem
          checked
          disabled
          onSelect={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{t("extensions.stlcLabel")}</span>
            <span className="text-[13px] leading-snug text-muted-foreground">{t("extensions.stlcDescription")}</span>
          </div>
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {TYPE_THEORIES.map((theory) => (
          <DropdownMenuCheckboxItem
            key={theory.id}
            checked={enabledTheories[theory.id]}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
