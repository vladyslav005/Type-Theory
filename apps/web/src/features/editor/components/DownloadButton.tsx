import {useTranslation} from "react-i18next";
import {Download} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";

const VSCODE_EXTENSION_URL = "https://marketplace.visualstudio.com/items?itemName=vladyslav005.tt-vscode-extension";

export interface DownloadButtonProps {
  getText: () => string;
}

export function DownloadButton({getText}: DownloadButtonProps) {
  const {t} = useTranslation();

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([getText()], {type: "text/plain;charset=utf-8"}));
    const a = document.createElement("a");
    a.href = url;
    a.download = "program.tt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleDownload}
            aria-label={t("editor.download")}
          >
            <Download className="h-4 w-4"/>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {t("editor.downloadTooltip")}{" "}
          <a
            href={VSCODE_EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {t("editor.downloadVscodeLink")}
          </a>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
