import type {Attempt} from "@/shared/activity/activityStore.ts";
import {labTasks, type LabTaskInfo} from "@/features/docs/labs/labTaskCatalog.ts";

export interface TaskStatus extends LabTaskInfo {
  seconds: number;
  solvedItems: number;
  attempts: number;
  reveals: number;
  started: boolean;
  done: boolean;
  lastAt?: string;
}

export interface LabStatus {
  slug: string;
  tasks: TaskStatus[];
  solvedItems: number;
  totalItems: number;
  tasksDone: number;
  seconds: number;
  lastAt?: string;
}

// Practice steps and hint checks are activity, not answers — they never mark an item solved.
const isWorkingStep = (attempt: Attempt) => attempt.kind === "step" || attempt.kind === "wrongStep" || !!attempt.kind?.startsWith("check:");
const later = (a: string | undefined, b: string | undefined) => (!a ? b : !b ? a : a > b ? a : b);

export function labStatus(slug: string, attempts: Attempt[], taskSeconds: Record<string, number> = {}): LabStatus {
  const prefix = `lab:${slug}/`;
  const ofLab = attempts.filter((attempt) => attempt.task.startsWith(prefix));
  const tasks = labTasks(slug).map((info): TaskStatus => {
    const own = ofLab.filter((attempt) => attempt.task.slice(prefix.length).split("/")[0] === info.id);
    const solved = new Set(own.filter((a) => a.ok && !a.reveal && !isWorkingStep(a)).map((a) => a.task));
    const solvedItems = Math.min(solved.size, info.items);
    const taskPrefix = `${prefix}${info.id}`;
    const seconds = Object.entries(taskSeconds)
      .filter(([task]) => task === taskPrefix || task.startsWith(`${taskPrefix}/`))
      .reduce((sum, [, value]) => sum + value, 0);
    return {
      ...info,
      seconds,
      solvedItems,
      attempts: own.filter((a) => !a.reveal && !isWorkingStep(a)).length,
      reveals: own.filter((a) => a.reveal).length,
      started: own.length > 0,
      done: solvedItems >= info.items,
      lastAt: own.reduce<string | undefined>((latest, a) => later(latest, a.at), undefined),
    };
  });
  return {
    slug,
    tasks,
    solvedItems: tasks.reduce((sum, task) => sum + task.solvedItems, 0),
    totalItems: tasks.reduce((sum, task) => sum + task.items, 0),
    tasksDone: tasks.filter((task) => task.done).length,
    seconds: tasks.reduce((sum, task) => sum + task.seconds, 0),
    lastAt: tasks.reduce<string | undefined>((latest, task) => later(latest, task.lastAt), undefined),
  };
}
