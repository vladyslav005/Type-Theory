import {useState} from "react";
import {CircleHelp} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";
import {Popover, PopoverContent, PopoverTrigger} from "@/shared/components/ui/popover.tsx";

// Shows on hover like a tooltip; a click pins it open (touch screens have no hover).
export function HelpHint({text}: {text: string}) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  return (
    <Popover
      open={hovered || pinned}
      onOpenChange={(open) => {
        if (!open) {
          setPinned(false);
          setHovered(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={text}
          onClick={() => setPinned((p) => !p)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <CircleHelp className="h-4 w-4"/>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-auto max-w-xs px-3 py-2 text-xs" onOpenAutoFocus={(e) => e.preventDefault()}>
        {text}
      </PopoverContent>
    </Popover>
  );
}
