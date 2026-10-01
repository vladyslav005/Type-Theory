import {lazy, Suspense, type ComponentProps} from "react";
import {Loader2} from "lucide-react";
import type {AstVisualisation as AstVisualisationType} from "@/features/ast/components/AstVisualisation.tsx";

// Keeps React Flow + dagre out of the editor's initial chunk.
const AstVisualisation = lazy(() =>
  import("@/features/ast/components/AstVisualisation.tsx").then((m) => ({default: m.AstVisualisation})),
);

export function LazyAstVisualisation(props: ComponentProps<typeof AstVisualisationType>) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin"/>
        </div>
      }
    >
      <AstVisualisation {...props}/>
    </Suspense>
  );
}
