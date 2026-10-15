import {Fragment} from "react";
import {useTranslation} from "react-i18next";
import {useLocation, useNavigate} from "react-router-dom";
import {GraduationCap} from "lucide-react";
import {Button} from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {startTour, useTourSeen} from "@/features/tour/tourStore.ts";
import {TOUR_GROUPS, TOURS, type TourId} from "@/features/tour/tours.ts";

export function TourMenu({onStart}: {onStart?: () => void}) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {pathname} = useLocation();
  const seen = useTourSeen();

  const start = (id: TourId) => {
    onStart?.();
    if (pathname !== "/main") navigate("/main");
    startTour(id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-11 gap-1.5 rounded-lg px-3 md:h-9 md:px-2.5"
          aria-label={t("topbar.startTour")}
          title={t("topbar.startTourHint")}
          data-tour="tour"
        >
          <GraduationCap className="h-4 w-4"/>
          <span className="hidden text-sm lg:inline">{t("topbar.startTour")}</span>
          {!seen && <span className="absolute right-1 top-1 size-2 rounded-full bg-primary animate-pulse"/>}
        </Button>
      </DropdownMenuTrigger>
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
  );
}
