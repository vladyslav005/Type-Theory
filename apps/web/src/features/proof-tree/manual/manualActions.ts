import {createContext, useContext, useMemo} from "react";
import type {ManualField, ManualNode} from "@/shared/ui-state/manualProof.ts";
import {useAppDispatch} from "@/shared/hooks/reduxHooks.ts";
import {addManualPremise, removeManualPremise, setManualConstraintsShown, setManualField} from "@/shared/ui-state/termSlice.ts";

export interface ManualActions {
  setField: (nodeId: string, field: ManualField, value: string) => void;
  setConstraintsShown: (nodeId: string, shown: boolean) => void;
  addPremise: (parentId: string, kind: ManualNode["kind"]) => void;
  removePremise: (nodeId: string) => void;
}

// Lets a lab task keep its own tree; without a provider the editor workspace's build mode is edited.
export const ManualActionsContext = createContext<ManualActions | null>(null);

export function useManualActions(): ManualActions {
  const local = useContext(ManualActionsContext);
  const dispatch = useAppDispatch();
  return useMemo(() => local ?? {
    setField: (nodeId, field, value) => dispatch(setManualField({nodeId, field, value})),
    setConstraintsShown: (nodeId, shown) => dispatch(setManualConstraintsShown({nodeId, shown})),
    addPremise: (parentId, kind) => dispatch(addManualPremise({parentId, kind})),
    removePremise: (nodeId) => dispatch(removeManualPremise({nodeId})),
  }, [local, dispatch]);
}
