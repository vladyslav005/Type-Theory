import {z} from "zod";

const EnvSchema = z.object({
  // Shows the "View Raw ... Data (DEBUG)" panels (Proof Tree, Logic Tree, AST, Evaluation steps).
  // Off by default — set VITE_SHOW_DEBUG_DATA=true in .env.local to turn them on.
  VITE_SHOW_DEBUG_DATA: z.string().optional().transform((v) => v === "true"),
  // Side "Feedback" and "Report bug" tabs. On by default — set VITE_SHOW_FEEDBACK_BUTTONS=false to hide.
  VITE_SHOW_FEEDBACK_BUTTONS: z.string().optional().transform((v) => v !== "false"),
});


const raw = {
  VITE_SHOW_DEBUG_DATA: import.meta.env.VITE_SHOW_DEBUG_DATA,
  VITE_SHOW_FEEDBACK_BUTTONS: import.meta.env.VITE_SHOW_FEEDBACK_BUTTONS,
};

export const env = EnvSchema.parse(raw);
