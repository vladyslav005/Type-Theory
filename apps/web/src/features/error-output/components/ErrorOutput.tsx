import {useTranslation} from "react-i18next";
import {cn} from "@/shared/lib/utils.ts";
import {useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {Card, CardContent} from "@/shared/components/ui/card.tsx";
import {motion} from "framer-motion";

export interface ErrorOutputProps {
  className?: string;
}

// eslint-disable-next-line react-refresh/only-export-components -- shared across many feature components
export const fadeInUp = {
  initial: {opacity: 0, y: 10},
  animate: {opacity: 1, y: 0},
  transition: {duration: 0.3},
};

export function ErrorOutput({
  className
} : ErrorOutputProps) {

  const {t} = useTranslation();
  const errors = useAppSelector((state) => state.term.processingErrors);
  const hasErrors = errors && errors.length > 0;

  return (
    <motion.div
      className={cn(className)}
      initial="initial"
      animate="animate"
      variants={fadeInUp}
    >
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 h-full flex flex-col">
        <CardContent className="pt-6 flex-1 overflow-auto">
          {hasErrors ? (
            <div className="space-y-3">
              {errors.map((error, index) => (
                <motion.div
                  key={index}
                  initial={{opacity: 0, x: -10}}
                  animate={{opacity: 1, x: 0}}
                  transition={{delay: index * 0.05, duration: 0.3}}
                  className="flex gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition-colors duration-200"
                >
                  <div className="shrink-0 mt-0.5">
                    <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center text-destructive text-xs font-semibold">
                      {index + 1}
                    </div>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed flex-1">
                    {error.message}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center rounded-xl bg-green-500/5 border border-green-500/20">
              <p className="text-sm text-muted-foreground">
                {t("errorsPanel.allValid")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}