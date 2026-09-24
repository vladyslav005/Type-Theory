import {useEffect, useState, type ReactNode, type RefObject} from "react";
import type {DockviewPanelApi, IDockviewPanelProps} from "dockview-react";
import {TextEditor, type TextEditorHandle} from "@/features/editor/components/TextEditor.tsx";
import {ErrorOutput} from "@/features/error-output/components/ErrorOutput.tsx";
import {EvaluationVisualisation} from "@/features/evaluation/components/EvaluationVisualisation.tsx";
import {ProofTreeVisualisation} from "@/features/proof-tree/components/ProofTreeVisualisation.tsx";
import {AstVisualisation} from "@/features/ast/components/AstVisualisation.tsx";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {setTermText} from "@/shared/ui-state/termSlice.ts";
import {useViewTime, ViewVisibleContext} from "@/shared/activity/activityClock.ts";

function VisiblePanel({api, children}: {api: DockviewPanelApi; children: ReactNode}) {
  const [visible, setVisible] = useState(api.isVisible);
  useEffect(() => {
    const subscription = api.onDidVisibilityChange((e) => setVisible(e.isVisible));
    return () => subscription.dispose();
  }, [api]);
  return <ViewVisibleContext.Provider value={visible}>{children}</ViewVisibleContext.Provider>;
}

function ViewTime({view}: {view: string}) {
  useViewTime(view);
  return null;
}

export interface EditorPanelParams {
  editorRef: RefObject<TextEditorHandle | null>;
}

export function EditorPanel({params, api}: IDockviewPanelProps<EditorPanelParams>) {
  const dispatch = useAppDispatch();
  const buildModeActive = useAppSelector((state) => state.term.buildMode.active);
  const termText = useAppSelector((state) => state.term.termText);

  return (
    <div className="h-full p-2">
      <VisiblePanel api={api}><ViewTime view="editor"/></VisiblePanel>
      <TextEditor
        // eslint-disable-next-line react-hooks/refs -- ref created via useRef in AppLayout, threaded through dockview panel params
        ref={params.editorRef}
        className="h-full"
        defaultValue={termText ?? "a : T; (λ x : T . (x) ) a;"}
        height="100%"
        language="lambda"
        readOnly={buildModeActive}
        onChange={(value) => dispatch(setTermText(value))}
      />
    </div>
  );
}

export function ErrorOutputPanel({api}: IDockviewPanelProps) {
  return (
    <div className="h-full overflow-auto p-2">
      <VisiblePanel api={api}><ViewTime view="errors"/></VisiblePanel>
      <ErrorOutput className="h-full"/>
    </div>
  );
}

export function EvaluationPanel({api}: IDockviewPanelProps) {
  return (
    <div className="h-full overflow-auto p-2">
      <VisiblePanel api={api}><EvaluationVisualisation className="h-full"/></VisiblePanel>
    </div>
  );
}

export function ProofTreePanel({params, api}: IDockviewPanelProps<EditorPanelParams>) {
  return (
    <div className="h-full overflow-auto p-2">
      <VisiblePanel api={api}><ProofTreeVisualisation className="h-full" editorRef={params.editorRef}/></VisiblePanel>
    </div>
  );
}

export function AstPanel({params, api}: IDockviewPanelProps<EditorPanelParams>) {
  return (
    <div className="h-full overflow-auto p-2">
      <VisiblePanel api={api}><ViewTime view="ast"/></VisiblePanel>
      <AstVisualisation className="h-full" editorRef={params.editorRef}/>
    </div>
  );
}
