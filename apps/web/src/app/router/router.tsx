import {createBrowserRouter, Navigate} from "react-router-dom";
import {MainPage} from "../../pages/MainPage.tsx";
import {AppLayout} from "../layout/AppLayout.tsx";
import {HomePage} from "@/pages/HomePage.tsx";
import {NotFoundPage} from "@/pages/NotFoundPage.tsx";
import {ErrorPage} from "@/pages/ErrorPage.tsx";
import {ActivityPage} from "@/pages/ActivityPage.tsx";
import {STUDY_MODE} from "@/shared/activity/studyConfig.ts";
import {DocsLayout} from "@/pages/docs/DocsLayout.tsx";
import {DocsIndexPage} from "@/pages/docs/DocsIndexPage.tsx";
import {DocsLabPage} from "@/pages/docs/DocsLabPage.tsx";
import {DocsLecturePage} from "@/pages/docs/DocsLecturePage.tsx";
import {DocsRulesPage} from "@/pages/docs/DocsRulesPage.tsx";
import {DocsGrammarPage} from "@/pages/docs/DocsGrammarPage.tsx";
import {DocsGuideCoverPage} from "@/pages/docs/DocsGuideCoverPage.tsx";
import {DocsGuideAppendixCoverPage} from "@/pages/docs/DocsGuideAppendixCoverPage.tsx";


export const router = createBrowserRouter([
  {
    path: "/", element: <AppLayout/>,
    errorElement: <ErrorPage/>,
    children: [
      {index: true, element: <HomePage/>},
      {path: "/main", element: <MainPage/>},
      {path: "/about", element: <Navigate to="/" replace/>},
      ...(STUDY_MODE ? [{path: "/activity", element: <ActivityPage/>}] : []),
      {
        path: "/docs", element: <DocsLayout/>,
        children: [
          {index: true, element: <DocsIndexPage/>},
          {path: "rules", element: <DocsRulesPage/>},
          {path: "grammar", element: <DocsGrammarPage/>},
          {path: "guide-cover", element: <DocsGuideCoverPage/>},
          {path: "guide-appendix-cover", element: <DocsGuideAppendixCoverPage/>},
          {path: "labs/:slug", element: <DocsLabPage/>},
          {path: ":slug", element: <DocsLecturePage/>},
        ],
      },

      {path: "*", element: <NotFoundPage/>},

    ]
  },

])
