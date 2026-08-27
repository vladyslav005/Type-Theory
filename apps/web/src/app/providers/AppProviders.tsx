import {type ReactNode, useMemo} from "react";
import {Provider as ReduxProvider} from "react-redux";
import {store} from "./store";
import {DependencyProvider} from "./di/DependencyProvider.tsx";
import {makeDependencies} from "./di/makeDependencies.ts";
import {Toaster} from "@/shared/components/ui/sonner.tsx";
import {ThemeProvider} from "next-themes";
import {MathJaxContext} from "better-react-mathjax";
import {useHtmlLang} from "@/i18n/useHtmlLang.ts";


export function AppProviders({children}: { children: ReactNode }) {

  useHtmlLang();

  const repos = useMemo(() => (makeDependencies()), []);

  const mathJaxConfig = {
    loader: {
      load: ['input/tex', 'output/chtml']
    },
    options: {
      enableMenu: false,
      a11y: {
        enableExplorer: false,
        speech: false,
        braille: false
      }
    }
  };

  return (
    <ReduxProvider store={store}>
      <DependencyProvider value={repos}>
        <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem>
          <MathJaxContext config={mathJaxConfig}>
            {children}
            <Toaster/>
          </MathJaxContext>
        </ThemeProvider>
      </DependencyProvider>
    </ReduxProvider>
  );
}