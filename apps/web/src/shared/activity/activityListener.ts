import {createListenerMiddleware, isAnyOf} from "@reduxjs/toolkit";
import type {ProofTree} from "@vladyslav005/tt-core";
import {checkProof, enterBuildMode, setEvaluation, setManualResults, setProof, setTheoryEnabled, type TermState} from "@/shared/ui-state/termSlice.ts";
import type {StudentProofNode} from "@/shared/ui-state/studentProof.ts";
import {bump, countBucket, isCollecting, recordWeek, type WeekStats} from "@/shared/activity/activityStore.ts";
import {manualNodeRules} from "@/features/proof-tree/manual/manualCheck.ts";
import type {ManualNode} from "@/shared/ui-state/manualProof.ts";

type State = {term: TermState};

const STUDENT_CHECKS = ["ruleCheck", "typeCheck", "contextCheck", "constraintCheck", "generalizeCheck"] as const;

function failedRules(node: ProofTree, out: string[] = []): string[] {
  if (node.error) out.push(node.rule);
  node.premises.forEach((premise) => failedRules(premise, out));
  return out;
}

function checksById(node: StudentProofNode | undefined, out = new Map<string, StudentProofNode>()) {
  if (!node) return out;
  out.set(node.id, node);
  node.premises.forEach((premise) => checksById(premise, out));
  return out;
}

// Pairs each student node with its answer-key node so checks are keyed by the correct rule.
function walkWithAnswer(student: StudentProofNode, answer: ProofTree, visit: (s: StudentProofNode, a: ProofTree) => void) {
  visit(student, answer);
  student.premises.forEach((premise, i) => answer.premises[i] && walkWithAnswer(premise, answer.premises[i], visit));
}

function semiNodeComplete(node: StudentProofNode): boolean {
  return node.ruleCheck === "valid" && node.typeCheck === "valid"
    && (!node.requiresContextBuild || node.contextCheck === "valid")
    && (!node.requiresConstraints || node.constraintCheck === "valid")
    && (!node.requiresGeneralize || node.generalizeCheck === "valid");
}

function manualNodesById(node: ManualNode, out = new Map<string, ManualNode>()) {
  out.set(node.id, node);
  node.premises.forEach((premise) => manualNodesById(premise, out));
  return out;
}

// Per build-mode exercise; reset whenever a new exercise starts.
let exercise = {checks: 0, completed: false, counted: new Map<string, string>()};

function recordCompletion(week: WeekStats, mode: string, complete: boolean) {
  exercise.checks++;
  if (!complete || exercise.completed) return;
  exercise.completed = true;
  bump(week.buildMode.completed, mode);
  bump(week.buildMode.checksToComplete, `${mode}:${countBucket(exercise.checks)}`);
}

export const activityListener = createListenerMiddleware();

activityListener.startListening({
  matcher: isAnyOf(setProof, setEvaluation, setTheoryEnabled, enterBuildMode, checkProof, setManualResults),
  effect: (action, api) => {
    if (!isCollecting()) return;
    const before = (api.getOriginalState() as State).term;
    const after = (api.getState() as State).term;

    if (setProof.match(action)) {
      const proof = action.payload.proof;
      const rules = proof ? failedRules(proof) : [];
      const hasErrors = rules.length > 0 || (after.processingErrors?.length ?? 0) > 0;
      recordWeek((week, internal) => {
        if (!proof) {
          week.typecheck.parseFailed++;
          internal.failureStreak++;
        } else if (hasErrors) {
          week.typecheck.failed++;
          rules.forEach((rule) => bump(week.typecheck.failedRules, rule));
          internal.failureStreak++;
        } else {
          week.typecheck.ok++;
          if (internal.failureStreak > 0) bump(week.typecheck.streaks, countBucket(internal.failureStreak));
          internal.failureStreak = 0;
        }
      });
    } else if (setEvaluation.match(action)) {
      if (!action.payload) return;
      const reachedLimit = action.payload.reachedStepLimit;
      recordWeek((week) => {
        bump(week.evaluate, after.evaluationStrategy);
        if (reachedLimit) bump(week.evaluate, "stepLimit");
      });
    } else if (setTheoryEnabled.match(action)) {
      if (action.payload.enabled) recordWeek((week) => bump(week.theoriesEnabled, action.payload.id));
    } else if (enterBuildMode.match(action)) {
      exercise = {checks: 0, completed: false, counted: new Map()};
      if (after.buildMode.active) recordWeek((week) => bump(week.buildMode.entered, after.buildMode.mode ?? "semi"));
    } else if (checkProof.match(action)) {
      const {studentTree, answerKey} = after.buildMode;
      if (!studentTree || !answerKey) return;
      const previous = checksById(before.buildMode.studentTree);
      let complete = true;
      recordWeek((week) => {
        week.buildMode.checks++;
        walkWithAnswer(studentTree, answerKey, (node, answer) => {
          if (!semiNodeComplete(node)) complete = false;
          STUDENT_CHECKS.forEach((check) => {
            if (!node[check] || previous.get(node.id)?.[check]) return;
            bump(node[check] === "valid" ? week.buildMode.ok : week.buildMode.wrong, `${answer.rule}:${check.replace("Check", "")}`);
          });
        });
        recordCompletion(week, "semi", complete);
      });
    } else if (setManualResults.match(action)) {
      const {manualTree, answerKey, manualDefinitions = ""} = after.buildMode;
      const results = action.payload;
      if (!manualTree || !answerKey || Object.keys(results).length === 0) return;
      const {rules, expected} = manualNodeRules(manualTree, answerKey);
      const nodes = manualNodesById(manualTree);
      recordWeek((week) => {
        week.buildMode.checks++;
        Object.entries(results).forEach(([id, result]) => {
          const node = nodes.get(id);
          const signature = node && JSON.stringify([node.kind, node.rule, node.gamma, node.term, node.type, node.constraints, node.fact, node.premises.length, manualDefinitions, result]);
          if (!signature || exercise.counted.get(id) === signature) return;
          exercise.counted.set(id, signature);
          const rule = rules[id] ?? "extra";
          Object.entries(result).forEach(([field, verdict]) => {
            if (verdict === "valid") bump(week.buildMode.ok, `manual:${rule}:${field}`);
            else if (verdict === "invalid") bump(week.buildMode.wrong, `manual:${rule}:${field}`);
          });
          result.messages.forEach((message) => bump(week.buildMode.messages, message.code));
        });
        const allValid = Object.values(results).every((result) =>
          !Object.values(result).includes("invalid") && !result.messages.some((m) => m.code === "extraPremise"));
        recordCompletion(week, "manual", allValid && nodes.size === expected && Object.keys(rules).length === expected);
      });
    }
  },
});
