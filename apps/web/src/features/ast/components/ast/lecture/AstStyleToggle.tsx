import {useTranslation} from "react-i18next";
import {LayoutTemplate, Network} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";
import {Tip} from "@/shared/components/Tip.tsx";
import {type AstViewStyle, setAstViewStyle, useAstViewStyle} from "@/features/ast/hooks/useAstViewStyle.ts";
import {runBusy} from "@/shared/lib/busy.ts";

// Uncontrolled it switches the remembered viewer style; the Editor tab passes its own preview state.
export function AstStyleToggle({style: controlled, onChange = setAstViewStyle}: {style?: AstViewStyle; onChange?: (style: AstViewStyle) => void}) {
  const {t} = useTranslation();
  const remembered = useAstViewStyle();
  const style = controlled ?? remembered;
  const lecture = style === "lecture";
  return (
    <Tip label={t(lecture ? "astPanel.viewCards" : "astPanel.viewLecture")}>
      <Button
        size="icon"
        variant="secondary"
        onClick={() => runBusy("ast", () => onChange(lecture ? "cards" : "lecture"))}
        aria-label={t(lecture ? "astPanel.viewCards" : "astPanel.viewLecture")}
        className="shadow-lg hover:shadow-xl transition-shadow"
      >
        {lecture ? <LayoutTemplate className="h-4 w-4"/> : <Network className="h-4 w-4"/>}
      </Button>
    </Tip>
  );
}
