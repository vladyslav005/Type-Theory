import {useState} from 'react';
import type {RefObject} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {BookType, Github, Menu, Moon, Sun, X} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {Button} from '@/shared/components/ui/button';
import {Separator} from '@/shared/components/ui/separator';
import {NavLink, useLocation} from "react-router-dom";
import {useTheme} from "next-themes";
import {LanguageMenu} from "@/app/layout/LanguageMenu.tsx";
import {TypeTheoriesDropdown} from "@/features/editor/components/TypeTheoriesDropdown.tsx";
import {ActiveExtensionsBadges} from "@/features/editor/components/ActiveExtensionsBadges.tsx";
import {LayoutPresetsDropdown} from "@/features/workspace/components/LayoutPresetsDropdown.tsx";
import {ExamplesDropdown} from "@/features/editor/components/ExamplesDropdown.tsx";
import type {TextEditorHandle} from "@/features/editor/components/TextEditor.tsx";
import {useAppDispatch} from "@/shared/hooks/reduxHooks.ts";
import {setTermText} from "@/shared/ui-state/termSlice.ts";

type NavItem = {
  key: 'editor' | 'docs' | 'about';
  href: string;
};

const navItems: NavItem[] = [
  {key: 'editor', href: '/main'},
  {key: 'docs', href: '/docs'},
  {key: 'about', href: '/'},
];

export interface TopbarProps {
  editorRef: RefObject<TextEditorHandle | null>;
}

export function Topbar({editorRef}: TopbarProps) {
  const {t} = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const {setTheme, resolvedTheme} = useTheme()
  const isDarkMode = resolvedTheme === "dark";
  const dispatch = useAppDispatch();
  const {pathname} = useLocation();
  const isEditorPage = pathname === "/main";

  const onSelectExample = (code: string) => {
    editorRef.current?.setValue(code);
    dispatch(setTermText(code));
  };

  const toggleDarkMode = () => {
    setTheme(isDarkMode ? "light" : "dark");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/50 backdrop-blur-md border-b shadow-sm">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: Logo and Brand */}
          <NavLink to="/" className="flex items-center gap-3 shrink-0 rounded-lg">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-full bg-primary shadow-lg hover:transform-y-1 transition-transform duration-200">
              <BookType className="w-6 h-6 text-primary-foreground"/>
            </div>
            <div className="hidden sm:block">
              <span className="block text-xl font-bold text-foreground leading-tight">
                {t("topbar.brand")}
              </span>
              <span className="block text-xs text-muted-foreground leading-tight">
                {t("topbar.tagline")}
              </span>
            </div>
          </NavLink>

          {/* Center: Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({isActive}) => `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
              >
                {t(`nav.${item.key}`)}
              </NavLink>
            ))}
          </nav>

          {/* Right: workspace tools (editor page only) + global controls */}
          <div className="flex items-center gap-2 min-w-0">
            <AnimatePresence initial={false}>
              {isEditorPage && (
                <motion.div
                  key="workspace-tools"
                  initial={{opacity: 0, width: 0}}
                  animate={{opacity: 1, width: "auto"}}
                  exit={{opacity: 0, width: 0}}
                  transition={{duration: 0.25, ease: "easeOut"}}
                  className="hidden md:flex items-center gap-2 min-w-0 overflow-hidden"
                >
                  <ExamplesDropdown onSelect={onSelectExample}/>
                  <TypeTheoriesDropdown/>
                  <div className="hidden lg:block">
                    <LayoutPresetsDropdown/>
                  </div>
                  <Separator orientation="vertical" className="h-6 mx-1"/>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="rounded-lg size-11 md:size-9"
                aria-label={isDarkMode ? t("topbar.themeToLight") : t("topbar.themeToDark")}
              >
                {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
              </Button>

              <LanguageMenu className="rounded-lg size-11 md:size-9"/>

              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg size-11 md:size-9"
                aria-label={t("topbar.openGithub")}
                onClick={() => window.location.assign("https://github.com/vladyslav005/tt")}
              >
                <Github className="h-4 w-4"/>
              </Button>

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden rounded-lg size-11"
                aria-label={isMobileMenuOpen ? t("topbar.closeMenu") : t("topbar.openMenu")}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
              </Button>
            </div>
          </div>
        </div>

        {/* Active extensions badges, pinned straddling the topbar's bottom edge */}
        <div className="hidden md:flex absolute -bottom-2.5 left-4 sm:left-6 lg:left-8 max-w-[60%] flex-wrap justify-start gap-1">
          <ActiveExtensionsBadges/>
        </div>
      </div>

      {/* Mobile drawer backdrop — opaque and dimmed so page content never bleeds through, tap to close */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 top-16 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Navigation Menu */}
      <div
        className={`
          md:hidden relative z-50 overflow-hidden transition-all duration-300 ease-in-out bg-background
          ${isMobileMenuOpen ? 'max-h-[calc(100dvh-4rem)] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="px-4 py-3 space-y-2 border-t">
          {isEditorPage && (
            <div className="flex flex-col items-start gap-2 pb-3 mb-1 border-b">
              <ExamplesDropdown onSelect={onSelectExample}/>
              <TypeTheoriesDropdown/>
              <ActiveExtensionsBadges/>
            </div>
          )}

          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({isActive}) => `w-full block text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-11 ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
            >
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  );
}
