import {Fragment, useEffect, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {GraduationCap, X} from "lucide-react";
import {Button} from "@/shared/components/ui/button";
import {cn} from "@/shared/lib/utils";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {dismissTourHint, startTour, useTourHintWanted, useTourSeen} from "@/features/tour/tourStore.ts";
import {TOUR_GROUPS, TOURS, type TourId} from "@/features/tour/tours.ts";

export function TourMenu({onStart, className}: {onStart?: () => void; className?: string}) {
  const {t} = useTranslation();
  const seen = useTourSeen();
  const hintWanted = useTourHintWanted();
  // A short delay so the hint arrives after the page has settled instead of with it.
  const [hintReady, setHintReady] = useState(false);
  useEffect(() => {
    if (!hintWanted) return;
    const timer = setTimeout(() => setHintReady(true), 1200);
    return () => clearTimeout(timer);
  }, [hintWanted]);
  const showHint = hintWanted && hintReady;

  const start = (id: TourId) => {
    onStart?.();
    startTour(id);
  };

  return (
    <span className="relative inline-flex">
    <DropdownMenu onOpenChange={(open) => open && dismissTourHint()}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("relative rounded-lg size-11 md:size-9", className)}
                aria-label={t("topbar.startTour")}
                data-tour="tour"
              >
                <GraduationCap className="h-4 w-4"/>
                {!seen && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary animate-pulse"/>}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("topbar.startTour")} — {t("topbar.startTourHint")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="max-h-[calc(100dvh-5rem)] w-80 overflow-y-auto">
        {TOUR_GROUPS.map((group, i) => (
          <Fragment key={group.key}>
            {i > 0 && <DropdownMenuSeparator/>}
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t(`tour.groups.${group.key}`)}</DropdownMenuLabel>
            {group.tours.map((id) => (
              <DropdownMenuItem key={id} className="flex-col items-start gap-0.5" onSelect={() => start(id)}>
                <span className="flex items-center gap-2 font-medium">
                  {t(`tour.tours.${id}.title`)}
                  {TOURS[id].code !== undefined && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{t("tour.interactiveBadge")}</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{t(`tour.tours.${id}.description`)}</span>
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
    <AnimatePresence>
      {showHint && (
        <motion.div
          role="status"
          initial={{opacity: 0, y: -6}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: -6}}
          transition={{duration: 0.25, ease: "easeOut"}}
          className="absolute right-0 top-full z-50 mt-3 w-72 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl"
        >
          <span className="absolute -top-1.5 right-3.5 size-3 rotate-45 border-l border-t bg-popover"/>
          <div className="flex items-start gap-2">
            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>
            <div className="flex-1">
              <p className="text-sm font-semibold">{t("tour.hint.title")}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("tour.hint.body")}</p>
            </div>
            <Button variant="ghost" size="icon" className="-mr-1 -mt-1 size-6 shrink-0" onClick={dismissTourHint} aria-label={t("tour.hint.later")}>
              <X className="h-3.5 w-3.5"/>
            </Button>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={dismissTourHint}>{t("tour.hint.later")}</Button>
            <Button size="sm" onClick={() => start("overview")}>{t("tour.hint.start")}</Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </span>
  );
}
