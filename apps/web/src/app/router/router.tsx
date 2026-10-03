import {createBrowserRouter, Navigate} from "react-router-dom";
import {AppLayout} from "../layout/AppLayout.tsx";
import {HomePage} from "@/pages/HomePage.tsx";
import {ErrorPage} from "@/pages/ErrorPage.tsx";
import {STUDY_MODE} from "@/shared/activity/studyConfig.ts";

const loadMainPage = () => import("@/pages/MainPage.tsx");
const loadDocsLayout = () => import("@/pages/docs/DocsLayout.tsx");

// Warm the most likely next pages once the landing page is idle, so the first click is instant.
const prefetch = () => {
  void loadMainPage();
  void loadDocsLayout();
};
if (typeof window !== "undefined") {
  if ("requestIdleCallback" in window) window.requestIdleCallback(prefetch, {timeout: 4000});
  else setTimeout(prefetch, 2000);
}

export const router = createBrowserRouter([
  {
    path: "/", element: <AppLayout/>,
    errorElement: <ErrorPage/>,
    children: [
      {index: true, element: <HomePage/>},
      {path: "/main", lazy: async () => ({Component: (await loadMainPage()).MainPage})},
      {path: "/about", element: <Navigate to="/" replace/>},
      {path: "/feedback", lazy: async () => ({Component: (await import("@/pages/FeedbackPage.tsx")).FeedbackPage})},
      ...(STUDY_MODE ? [{path: "/activity", lazy: async () => ({Component: (await import("@/pages/ActivityPage.tsx")).ActivityPage})}] : []),
      {
        path: "/docs", lazy: async () => ({Component: (await loadDocsLayout()).DocsLayout}),
        children: [
          {index: true, lazy: async () => ({Component: (await import("@/pages/docs/DocsIndexPage.tsx")).DocsIndexPage})},
          {path: "rules", lazy: async () => ({Component: (await import("@/pages/docs/DocsRulesPage.tsx")).DocsRulesPage})},
          {path: "grammar", lazy: async () => ({Component: (await import("@/pages/docs/DocsGrammarPage.tsx")).DocsGrammarPage})},
          {path: "guide-cover", lazy: async () => ({Component: (await import("@/pages/docs/DocsGuideCoverPage.tsx")).DocsGuideCoverPage})},
          {path: "guide-appendix-cover", lazy: async () => ({Component: (await import("@/pages/docs/DocsGuideAppendixCoverPage.tsx")).DocsGuideAppendixCoverPage})},
          {path: "labs/:slug", lazy: async () => ({Component: (await import("@/pages/docs/DocsLabPage.tsx")).DocsLabPage})},
          {path: ":slug", lazy: async () => ({Component: (await import("@/pages/docs/DocsLecturePage.tsx")).DocsLecturePage})},
        ],
      },

      {path: "*", lazy: async () => ({Component: (await import("@/pages/NotFoundPage.tsx")).NotFoundPage})},

    ]
  },

])
