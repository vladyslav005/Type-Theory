import type {DockviewApi} from "dockview-react";
import type {LayoutPresetId} from "@/shared/ui-state/workspaceLayoutSlice.ts";
import type {EditorPanelParams} from "@/features/workspace/components/panels.tsx";
import i18n from "@/i18n";

const title = {
  editor: () => i18n.t("panels.editor"),
  errors: () => i18n.t("panels.errors"),
  evaluation: () => i18n.t("panels.evaluation"),
  proofTree: () => i18n.t("panels.proofTree"),
  ast: () => i18n.t("panels.ast"),
};

export function applyLayoutPreset(api: DockviewApi, preset: LayoutPresetId, editorParams: EditorPanelParams): void {
  api.clear();

  switch (preset) {
    case "editorFocus":
      applyEditorFocus(api, editorParams);
      break;
    case "editorWide":
      applyEditorWide(api, editorParams);
      break;
    case "grid":
      applyGrid(api, editorParams);
      break;
    case "editorErrors":
      applyEditorErrors(api, editorParams);
      break;
  }
}

function applyEditorFocus(api: DockviewApi, editorParams: EditorPanelParams): void {
  api.addPanel({id: "editor", component: "editor", title: title.editor(), params: editorParams});
  api.addPanel({
    id: "errorOutput",
    component: "errorOutput",
    title: title.errors(),
    position: {referencePanel: "editor", direction: "right"},
  });
  addResultTabs(api, editorParams);
}

function applyEditorWide(api: DockviewApi, editorParams: EditorPanelParams): void {
  api.addPanel({id: "editor", component: "editor", title: title.editor(), params: editorParams});
  api.addPanel({
    id: "errorOutput",
    component: "errorOutput",
    title: title.errors(),
    position: {referencePanel: "editor", direction: "below"},
  });
  addResultTabs(api, editorParams);

  if (api.height > 0) {
    api.getPanel("editor")?.api.setSize({height: Math.round(api.height * 0.6)});
  }
}

function applyGrid(api: DockviewApi, editorParams: EditorPanelParams): void {
  api.addPanel({id: "editor", component: "editor", title: title.editor(), params: editorParams});
  api.addPanel({
    id: "errorOutput",
    component: "errorOutput",
    title: title.errors(),
    position: {referencePanel: "editor", direction: "right"},
  });
  api.addPanel({
    id: "proofTree",
    component: "proofTree",
    title: title.proofTree(),
    position: {referencePanel: "errorOutput", direction: "right"},
  });
  api.addPanel({
    id: "evaluation",
    component: "evaluation",
    title: title.evaluation(),
    position: {referencePanel: "errorOutput", direction: "below"},
  });
  api.addPanel({
    id: "ast",
    component: "ast",
    title: title.ast(),
    params: editorParams,
    position: {referencePanel: "proofTree", direction: "below"},
  });

  if (api.width > 0) {
    api.getPanel("editor")?.api.setSize({width: Math.round(api.width * 0.35)});
  }
}

// Editor and Errors side by side on top; everything else tabbed together, spanning the full
// width below. The bottom group is docked with an absolute (not relative-to-panel) position so
// it sits under the whole top row instead of just under "editor".
function applyEditorErrors(api: DockviewApi, editorParams: EditorPanelParams): void {
  api.addPanel({id: "editor", component: "editor", title: title.editor(), params: editorParams});
  api.addPanel({
    id: "errorOutput",
    component: "errorOutput",
    title: title.errors(),
    position: {referencePanel: "editor", direction: "right"},
  });
  api.addPanel({
    id: "evaluation",
    component: "evaluation",
    title: title.evaluation(),
    position: {direction: "below"},
  });
  api.addPanel({
    id: "proofTree",
    component: "proofTree",
    title: title.proofTree(),
    position: {referencePanel: "evaluation", direction: "within"},
  });
  api.addPanel({
    id: "ast",
    component: "ast",
    title: title.ast(),
    params: editorParams,
    position: {referencePanel: "evaluation", direction: "within"},
  });
  api.getPanel("evaluation")?.api.setActive();

  if (api.width > 0) {
    api.getPanel("errorOutput")?.api.setSize({width: Math.round(api.width * 0.25)});
  }
}

function addResultTabs(api: DockviewApi, editorParams: EditorPanelParams): void {
  api.addPanel({
    id: "evaluation",
    component: "evaluation",
    title: title.evaluation(),
    position: {referencePanel: "errorOutput", direction: "within"},
  });
  api.addPanel({
    id: "proofTree",
    component: "proofTree",
    title: title.proofTree(),
    position: {referencePanel: "errorOutput", direction: "within"},
  });
  api.addPanel({
    id: "ast",
    component: "ast",
    title: title.ast(),
    params: editorParams,
    position: {referencePanel: "errorOutput", direction: "within"},
  });
  api.getPanel("errorOutput")?.api.setActive();
}
