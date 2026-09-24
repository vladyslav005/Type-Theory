import {useRef} from "react";
import {Outlet, useLocation} from "react-router-dom";
import {Topbar} from "@/app/layout/TopBar.tsx";
import {Footer} from "@/app/layout/Footer.tsx";
import {FeedbackButton} from "@/shared/components/FeedbackButton.tsx";
import {BugReportButton} from "@/shared/components/BugReportButton.tsx";
import {env} from "@/shared/lib/env.ts";
import {ActivityConsentCard} from "@/shared/components/ActivityConsentCard.tsx";
import {useActivitySession} from "@/shared/activity/useActivity.ts";
import type {TextEditorHandle} from "@/features/editor/components/TextEditor.tsx";

export interface AppOutletContext {
  editorRef: React.RefObject<TextEditorHandle | null>;
}

export function AppLayout() {
  const {pathname} = useLocation();
  const hideFooter = pathname === "/main";
  const editorRef = useRef<TextEditorHandle>(null);
  useActivitySession();

  return (
    <div className="">
      <Topbar editorRef={editorRef}></Topbar>
      <Outlet context={{editorRef} satisfies AppOutletContext}/>
      {!hideFooter && <Footer></Footer>}
      <ActivityConsentCard/>
      {env.VITE_SHOW_FEEDBACK_BUTTONS && (
        <>
          <FeedbackButton/>
          <BugReportButton/>
        </>
      )}
    </div>
  );
}