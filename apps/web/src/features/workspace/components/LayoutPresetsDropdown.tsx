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
import {LAYOUT_PRESETS, requestLayoutPreset, type LayoutPresetId} from "@/shared/ui-state/workspaceLayoutSlice.ts";
import {useAppDispatch} from "@/shared/hooks/reduxHooks.ts";

export interface LayoutPresetsDropdownProps {
  disabled?: boolean;
}

interface Pane {
  x: number;
  y: number;
  w: number;
  h: number;
  editor?: boolean;
  tabs?: boolean;
}

// Mirrors the panel arrangement in layoutPresets.ts on a 60×40 canvas.
const MINIATURES: Partial<Record<LayoutPresetId, Pane[]>> = {
  editorFocus: [
    {x: 2, y: 2, w: 27, h: 36, editor: true},
    {x: 31, y: 2, w: 27, h: 36, tabs: true},
  ],
  editorWide: [
    {x: 2, y: 2, w: 56, h: 22, editor: true},
    {x: 2, y: 26, w: 56, h: 12, tabs: true},
  ],
  grid: [
    {x: 2, y: 2, w: 19, h: 36, editor: true},
    {x: 23, y: 2, w: 16, h: 17},
    {x: 23, y: 21, w: 16, h: 17},
    {x: 41, y: 2, w: 17, h: 17},
    {x: 41, y: 21, w: 17, h: 17},
  ],
  editorErrors: [
    {x: 2, y: 2, w: 40, h: 20, editor: true},
    {x: 44, y: 2, w: 14, h: 20},
    {x: 2, y: 24, w: 56, h: 14, tabs: true},
  ],
};

function LayoutMiniature({preset}: {preset: LayoutPresetId}) {
  return (
    <svg viewBox="0 0 60 40" className="h-14 w-21" aria-hidden>
      {(MINIATURES[preset] ?? []).map((pane, i) => (
        <g key={i}>
          <rect
            x={pane.x}
            y={pane.y}
            width={pane.w}
            height={pane.h}
            rx={1.5}
            strokeWidth={0.75}
            className={pane.editor ? "fill-primary/25 stroke-primary" : "fill-muted stroke-muted-foreground/50"}
          />
          {pane.tabs && [0, 1, 2].map((tab) => (
            <rect
              key={tab}
              x={pane.x + 1.5 + tab * 7}
              y={pane.y + 1.5}
              width={6}
              height={2.5}
              rx={0.5}
              className={tab === 0 ? "fill-muted-foreground/70" : "fill-muted-foreground/30"}
            />
          ))}
        </g>
      ))}
    </svg>
  );
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
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("layoutPresets.trigger")}</DropdownMenuLabel>
        <DropdownMenuSeparator/>
        <div className="grid grid-cols-2 gap-1">
          {LAYOUT_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              title={t(`layoutPresets.${preset.id}.description`, preset.description)}
              aria-label={t(`layoutPresets.${preset.id}.label`, preset.label)}
              className="flex-col gap-1 p-2"
              onSelect={() => dispatch(requestLayoutPreset(preset.id))}
            >
              <LayoutMiniature preset={preset.id}/>
              <span className="text-xs text-muted-foreground">{t(`layoutPresets.${preset.id}.label`, preset.label)}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
