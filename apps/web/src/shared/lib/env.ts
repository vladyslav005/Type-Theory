import {z} from "zod";

const EnvSchema = z.object({
  // Shows the "View Raw ... Data (DEBUG)" panels (Proof Tree, Logic Tree, AST, Evaluation steps).
  // Off by default — set VITE_SHOW_DEBUG_DATA=true in .env.local to turn them on.
  VITE_SHOW_DEBUG_DATA: z.string().optional().transform((v) => v === "true"),
  // Side "Feedback" and "Report bug" tabs. On by default — set VITE_SHOW_FEEDBACK_BUTTONS=false to hide.
  VITE_SHOW_FEEDBACK_BUTTONS: z.string().optional().transform((v) => v !== "false"),
  // Semester study: opt-in usage tracking + /activity page, with auto-build hidden and forced off.
  // On by default — set VITE_STUDY_MODE=false to disable all of it and restore auto-build.
  VITE_STUDY_MODE: z.string().optional().transform((v) => v !== "false"),
  // Cloudflare Turnstile sitekey for the bug-report form. Unset disables the widget (and the API rejects reports).
  VITE_TURNSTILE_SITE_KEY: z.string().optional(),
});


const raw = {
  VITE_SHOW_DEBUG_DATA: import.meta.env.VITE_SHOW_DEBUG_DATA,
  VITE_SHOW_FEEDBACK_BUTTONS: import.meta.env.VITE_SHOW_FEEDBACK_BUTTONS,
  VITE_TURNSTILE_SITE_KEY: import.meta.env.VITE_TURNSTILE_SITE_KEY,
  VITE_STUDY_MODE: import.meta.env.VITE_STUDY_MODE,
};

export const env = EnvSchema.parse(raw);
