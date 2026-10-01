import {Settings} from "lucide-react";
import {useTranslation} from "react-i18next";
import {Button} from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {Label} from "@/shared/components/ui/label.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/shared/components/ui/select.tsx";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {setFontSize, setShowMinimap} from "@/shared/ui-state/termSlice.ts";

const FONT_SIZES = [12, 13, 14, 16, 18, 20, 24];

export function EditorSettingsDropdown() {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const fontSize = useAppSelector((state) => state.term.fontSize);
  const showMinimap = useAppSelector((state) => state.term.showMinimap);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={t("editor.settings")}
          aria-label={t("editor.settings")}
          className="shrink-0"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuCheckboxItem
          checked={showMinimap}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={(checked) => dispatch(setShowMinimap(checked))}
        >
          {t("editor.showMinimap")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <Label htmlFor="editor-font-size" className="text-sm font-normal">
            {t("editor.fontSize")}
          </Label>
          <Select
            value={String(fontSize)}
            onValueChange={(value) => dispatch(setFontSize(Number(value)))}
          >
            <SelectTrigger id="editor-font-size" size="sm" className="w-[5.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>{size}px</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
