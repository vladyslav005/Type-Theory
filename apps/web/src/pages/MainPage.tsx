import {useTranslation} from "react-i18next";
import {WorkspaceLayout} from "@/features/workspace/components/WorkspaceLayout.tsx";
import {usePageMeta} from "@/shared/hooks/usePageMeta.ts";

export function MainPage() {
  const {t} = useTranslation();
  usePageMeta(t("meta.main"));

  return (
    <div className="mt-[4rem] flex flex-col h-[calc(100dvh-4rem)]">
      {/*<div className=" shrink-0"></div>*/}
      <WorkspaceLayout className="flex-1 min-h-0 px-1 pb-1"/>
    </div>
  )
}