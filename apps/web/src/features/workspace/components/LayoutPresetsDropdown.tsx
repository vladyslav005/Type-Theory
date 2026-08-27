import {LayoutGrid} from "lucide-react";
import {useTranslation} from "react-i18next";
import {Button} from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {LAYOUT_PRESETS, requestLayoutPreset} from "@/shared/ui-state/workspaceLayoutSlice.ts";
import {useAppDispatch} from "@/shared/hooks/reduxHooks.ts";

export interface LayoutPresetsDropdownProps {
  disabled?: boolean;
}

export function LayoutPresetsDropdown({disabled = false}: LayoutPresetsDropdownProps) {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={disabled ? t("topbar.onlyOnEditor") : t("layoutPresets.trigger")}
          aria-label={t("layoutPresets.trigger")}
          disabled={disabled}
        >
          <LayoutGrid className="h-4 w-4"/>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t("layoutPresets.trigger")}</DropdownMenuLabel>
        <DropdownMenuSeparator/>
        {LAYOUT_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            onSelect={() => dispatch(requestLayoutPreset(preset.id))}
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t(`layoutPresets.${preset.id}.label`, preset.label)}</span>
              <span className="text-xs text-muted-foreground">{t(`layoutPresets.${preset.id}.description`, preset.description)}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
