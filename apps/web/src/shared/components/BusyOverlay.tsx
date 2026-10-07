import {Loader2} from "lucide-react";

// Covers a panel's content (its parent must be `relative`) while something heavy runs.
export function BusyOverlay({label}: {label: string}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin"/>
      <span className="text-sm">{label}</span>
    </div>
  );
}
