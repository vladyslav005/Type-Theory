import {useState, type ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {AlertTriangle} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";
import {useAppSelector} from "@/shared/hooks/reduxHooks.ts";

// Drawing a huge tree can freeze the page, so trees over the shared size limit wait for a click.
export function RenderGuard({size, guardKey, className, children}: {size: number; guardKey: string; className?: string; children: ReactNode}) {
  const {t} = useTranslation();
  const limit = useAppSelector((state) => state.term.proofTreeRenderLimit);
  const [allowedKey, setAllowedKey] = useState<string>();
  if (size <= limit || allowedKey === guardKey) return <>{children}</>;
  return (
    <div className={className ?? "flex-1 w-full h-full rounded-b-xl bg-muted/30 border flex items-center justify-center p-6"}>
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400"/>
        <p className="text-sm font-medium">{t("proofTree.renderGuard.title", {count: size})}</p>
        <p className="text-xs text-muted-foreground">{t("proofTree.renderGuard.body", {limit})}</p>
        <Button size="sm" variant="outline" onClick={() => setAllowedKey(guardKey)}>{t("proofTree.renderGuard.renderAnyway")}</Button>
      </div>
    </div>
  );
}
