import {motion} from 'framer-motion';
import {useTranslation} from 'react-i18next';
import {AlertCircle, FileQuestionMark} from 'lucide-react';
import {FloatingLambdaSymbols} from '@/shared/components/FloatingLambdaSymbols.tsx';
import {usePageMeta} from '@/shared/hooks/usePageMeta.ts';

const fadeInUp = {
  initial: {opacity: 0, y: 20},
  animate: {opacity: 1, y: 0},
  transition: {duration: 0.5},
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

export function NotFoundPage() {
  const {t} = useTranslation();
  usePageMeta(t("notFound.metaTitle"), "The page you're looking for doesn't exist.", undefined, {noindex: true});

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden">
      <FloatingLambdaSymbols />

      <motion.div
        className="relative max-w-2xl w-full text-center space-y-8"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        {/* Animated Water Droplet Icon */}
        <motion.div className="flex justify-center" variants={fadeInUp}>
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse"/>
            <div className="relative w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
              <FileQuestionMark className="w-16 h-16 text-primary animate-bounce"/>
            </div>
          </div>
        </motion.div>

        {/* Error Code */}
        <motion.div className="space-y-2" variants={fadeInUp}>
          <h1 className="text-8xl sm:text-9xl font-bold text-foreground tracking-tight">
            {t("notFound.code")}
          </h1>
          <p className="text-2xl sm:text-3xl font-semibold text-foreground">
            {t("notFound.title")}
          </p>
        </motion.div>

        {/* Description */}
        <motion.p className="text-lg text-muted-foreground max-w-md mx-auto" variants={fadeInUp}>
          {t("notFound.message")}
        </motion.p>

        {/* Help Message */}
        <motion.div className="pt-8 border-t border-border" variants={fadeInUp}>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4"/>
            <span>
              {t("notFound.needHelp")}{' '}
              <a href="mailto:idkwho@idkwhere.com" className="text-primary hover:underline">
                idkwho@idkwhere.com
              </a>
            </span>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
