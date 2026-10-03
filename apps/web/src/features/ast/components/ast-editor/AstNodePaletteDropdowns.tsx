import {ChevronDown} from "lucide-react";
import {useTranslation} from "react-i18next";
import {Button} from "@/shared/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu.tsx";
import {AST_NODE_PALETTE} from "@/features/ast/components/ast-editor/astNodePalette.ts";

export interface AstNodePaletteDropdownsProps {
  onInsert: (nodeType: string) => void;
  // Omit to show every node type, as the main app's editor does.
  allowedTypes?: string[];
}

// One dropdown per category (Terms, Types, Polymorphism, Declarations) instead of one long
// toolbar row — each keeps its sub-groups (Math, Sums, Lists, ...) as labeled sections inside.
export function AstNodePaletteDropdowns({onInsert, allowedTypes}: AstNodePaletteDropdownsProps) {
  const {t} = useTranslation();
  const categories = allowedTypes
    ? AST_NODE_PALETTE
      .map((category) => ({
        ...category,
        groups: category.groups
          .map((group) => ({...group, items: group.items.filter((item) => allowedTypes.includes(item.type))}))
          .filter((group) => group.items.length > 0),
      }))
      .filter((category) => category.groups.length > 0)
    : AST_NODE_PALETTE;

  return (
    <>
      {categories.map((category) => (
        <DropdownMenu key={category.id}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {t(`astNodes.categories.${category.id}`, category.label)}
              <ChevronDown className="h-3.5 w-3.5"/>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {category.groups.map((group, index) => (
              <div key={group.label}>
                {index > 0 && <DropdownMenuSeparator/>}
                <DropdownMenuLabel className="text-xs text-muted-foreground">{t(`astNodes.groups.${group.label}`, group.label)}</DropdownMenuLabel>
                <div className="flex flex-col px-1 pb-1">
                  {group.items.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      className="flex items-center gap-2 rounded-sm px-2 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                      onClick={() => onInsert(item.type)}
                    >
                      <span className="w-12 shrink-0 rounded border bg-muted/40 px-1 text-center font-mono font-bold">{item.label}</span>
                      <span>{t(`astNodes.items.${item.type}`, item.title)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </>
  );
}
