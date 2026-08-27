import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Copy, Download, Eye, FileText} from "lucide-react";
import {toast} from "sonner";
import type {TexTree} from "@vladyslav005/tt-core";
import {texTreeToEbproofDocument} from "@vladyslav005/tt-core";
import {useTexRefExpansion} from "@/features/proof-tree/components/proof-tree-using-css/TexRefExpansionContext.tsx";
import {downloadTextFile} from "@/shared/lib/downloadTextFile.ts";
import {Button} from "@/shared/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog.tsx";

interface ExportLatexButtonsProps {
  // Takes the currently-expanded key set so a caller building a TexTree from
  // something other than a plain proof (e.g. Build & Check's student tree)
  // can resolve its own Γ/def toggles the same way the shared renderer does.
  buildTree: (expandedKeys: ReadonlySet<string>) => TexTree;
  filename: string;
}

// Must render inside the TexRefExpansionProvider that scopes the tree being
// exported, so its expand/collapse snapshot matches what's on screen.
export function ExportLatexButtons({buildTree, filename}: ExportLatexButtonsProps) {
  const {t} = useTranslation();
  const {expandedKeys} = useTexRefExpansion();
  const [previewOpen, setPreviewOpen] = useState(false);

  const buildDocument = () => texTreeToEbproofDocument(buildTree(expandedKeys), {expandedKeys});

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildDocument());
      toast.success(t("latexExport.toastCopied"));
    } catch (e) {
      console.error("Failed to copy LaTeX", e);
      toast.error(t("latexExport.toastCopyFailed"));
    }
  };

  const download = () => {
    downloadTextFile(filename, buildDocument(), "text/x-tex");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="secondary"
            className="shadow-lg hover:shadow-xl transition-shadow"
            title={t("latexExport.trigger")}
          >
            <FileText className="h-4 w-4"/>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("latexExport.menuLabel")}</DropdownMenuLabel>
          <DropdownMenuSeparator/>
          <DropdownMenuItem onSelect={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4"/>
            {t("latexExport.preview")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={copy}>
            <Copy className="h-4 w-4"/>
            {t("latexExport.copy")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={download}>
            <Download className="h-4 w-4"/>
            {t("latexExport.downloadTex")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("latexExport.previewTitle")}</DialogTitle>
            <DialogDescription>
              {t("latexExport.previewDescription")}
            </DialogDescription>
          </DialogHeader>

          <pre className="max-h-[60vh] overflow-auto rounded-lg border bg-muted/30 p-4 text-xs font-mono whitespace-pre">
            {previewOpen ? buildDocument() : ""}
          </pre>

          <DialogFooter>
            <Button variant="outline" onClick={copy}>
              <Copy className="h-4 w-4"/>
              {t("latexExport.copy")}
            </Button>
            <Button onClick={download}>
              <Download className="h-4 w-4"/>
              {t("latexExport.downloadTex")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
