import {type TypedUseSelectorHook, useDispatch, useSelector, useStore} from "react-redux";
import type {AppDispatch, AppStore, RootState} from "@/app/providers/store.ts";


export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
// For values only needed at the moment of an action, without re-rendering when they change.
export const useAppStore = useStore.withTypes<AppStore>();
