import {useCallback, useEffect, useRef} from "react";
import {useTranslation} from "react-i18next";
import {useOutletContext} from "react-router-dom";
import type {AppOutletContext} from "@/app/layout/AppLayout.tsx";
import {
  DockviewDefaultTab,
  DockviewReact,
  themeDark,
  themeLight,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
  type SerializedDockview,
} from "dockview-react";
import {useTheme} from "next-themes";
import {
  AstPanel,
  EditorPanel,
  type EditorPanelParams,
  ErrorOutputPanel,
  EvaluationPanel,
  ProofTreePanel,
} from "@/features/workspace/components/panels.tsx";
import {applyLayoutPreset} from "@/features/workspace/components/layoutPresets.ts";
import {
  clearPersistedWorkspaceLayout,
  loadPersistedWorkspaceLayout,
  persistWorkspaceLayout,
} from "@/shared/ui-state/persistWorkspaceLayout.ts";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {clearPendingLayoutPreset} from "@/shared/ui-state/workspaceLayoutSlice.ts";
import {useMediaQuery} from "@/shared/hooks/useMediaQuery.ts";
import {MobileWorkspaceLayout} from "@/features/workspace/components/MobileWorkspaceLayout.tsx";

const components = {
  editor: EditorPanel,
  errorOutput: ErrorOutputPanel,
  evaluation: EvaluationPanel,
  proofTree: ProofTreePanel,
  ast: AstPanel,
};

const PANEL_IDS = ["editor", "errorOutput", "evaluation", "proofTree", "ast"];

function isRestorableLayout(data: SerializedDockview | undefined): data is SerializedDockview {
  return !!data?.panels && PANEL_IDS.every((id) => id in data.panels);
}

// No panel-add UI exists yet, so a closed panel would be unrecoverable — hide the close button until one does.
function WorkspaceTab(props: IDockviewPanelHeaderProps) {
  return <DockviewDefaultTab {...props} hideClose/>;
}

export interface WorkspaceLayoutProps {
  className?: string;
}

const PANEL_TITLE_KEYS = {
  editor: "panels.editor",
  errorOutput: "panels.errors",
  evaluation: "panels.evaluation",
  proofTree: "panels.proofTree",
  ast: "panels.ast",
} as const;

export function WorkspaceLayout({className}: WorkspaceLayoutProps) {
  const {editorRef} = useOutletContext<AppOutletContext>();
  const {t, i18n} = useTranslation();
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const apiRef = useRef<DockviewApi | null>(null);
  const {resolvedTheme} = useTheme();
  const dispatch = useAppDispatch();
  const pendingPreset = useAppSelector((state) => state.workspaceLayoutUi.pendingPreset);

  // A restored/serialized panel's `params` can't carry a live React ref through JSON, so the
  // editor/AST/proofTree panels need it re-injected after every build (fresh mount, restore, or preset switch).
  const rewireEditorRef = useCallback((api: DockviewApi) => {
    const editorParams: EditorPanelParams = {editorRef};
    api.getPanel("editor")?.api.updateParameters(editorParams);
    api.getPanel("ast")?.api.updateParameters(editorParams);
    api.getPanel("proofTree")?.api.updateParameters(editorParams);
  }, [editorRef]);

  const handleReady = (event: DockviewReadyEvent) => {
    const api = event.api;
    apiRef.current = api;
    const editorParams: EditorPanelParams = {editorRef};

    const saved = loadPersistedWorkspaceLayout();
    let restored = false;
    if (isRestorableLayout(saved)) {
      try {
        api.fromJSON(saved);
        restored = true;
      } catch (error) {
        console.warn("Failed to restore saved workspace layout, falling back to default", error);
        clearPersistedWorkspaceLayout();
      }
    }

    if (!restored) {
      applyLayoutPreset(api, "editorFocus", editorParams);
    }
    rewireEditorRef(api);

    let persistTimeout: ReturnType<typeof setTimeout> | undefined;
    api.onDidLayoutChange(() => {
      clearTimeout(persistTimeout);
      persistTimeout = setTimeout(() => persistWorkspaceLayout(api.toJSON()), 300);
    });
  };

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    for (const [id, key] of Object.entries(PANEL_TITLE_KEYS)) {
      api.getPanel(id)?.api.setTitle(t(key));
    }
  }, [t, i18n.language]);

  useEffect(() => {
    const api = apiRef.current;
    if (!pendingPreset || !api) return;

    applyLayoutPreset(api, pendingPreset, {editorRef});
    rewireEditorRef(api);
    persistWorkspaceLayout(api.toJSON());
    dispatch(clearPendingLayoutPreset());
  }, [pendingPreset, dispatch, editorRef, rewireEditorRef]);

  if (isMobile) {
    return <MobileWorkspaceLayout className={className}/>;
  }

  return (
    <div className={className}>
      <DockviewReact
        components={components}
        defaultTabComponent={WorkspaceTab}
        onReady={handleReady}
        theme={resolvedTheme === "dark" ? themeDark : themeLight}
      />
    </div>
  );
}
