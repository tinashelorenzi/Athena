import { EventEmitter } from "node:events";

/**
 * Wakes long-polling agents when a task is queued for their machine, so a
 * session started in the browser reaches the machine in about a second
 * instead of on the next poll. In-process only: with several app processes
 * the poll's periodic re-check still picks tasks up within a few seconds.
 */
const g = globalThis as unknown as { __athenaTaskEvents?: EventEmitter };
export const taskEvents = g.__athenaTaskEvents ?? (g.__athenaTaskEvents = new EventEmitter().setMaxListeners(0));

export function notifyMachine(machineId: string): void {
  taskEvents.emit(`machine:${machineId}`);
}

/** Resolves when the machine is notified, or after `ms`, whichever is first. */
export function waitForMachine(machineId: string, ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      taskEvents.off(`machine:${machineId}`, done);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    taskEvents.once(`machine:${machineId}`, done);
    signal?.addEventListener("abort", done, { once: true });
  });
}
