"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The one save queue of a draft page (spec 0020 AC-12). Saves run one at a time in the order made;
// a waiting save of the same field is replaced by the newer value in its place; a text field waits
// 800 ms after typing stops. A save that fails (the network, or the server could not write) stays
// failed until "إعادة المحاولة" or the browser's `online` event; a refusal is handled by the save
// itself and is not retried.

export type SaveStatus = "idle" | "saving" | "saved" | "failed";

/** What a save says when it finishes: done (saved or refused and shown), or worth a retry. */
export type SaveOutcome = "done" | "retry";

export type SaveTask = {
  /** One field: a later save with the same key replaces a waiting one. */
  readonly key: string;
  /** The line it belongs to, so removing the line drops it and a reply knows newer edits wait. */
  readonly lineId?: string;
  readonly run: () => Promise<SaveOutcome>;
};

export const TEXT_SAVE_DELAY_MS = 800;

export function useSaveQueue() {
  const waiting = useRef<SaveTask[]>([]);
  const failed = useRef<SaveTask[]>([]);
  const running = useRef<SaveTask | null>(null);
  const timers = useRef(
    new Map<string, { task: SaveTask; timer: ReturnType<typeof setTimeout> }>(),
  );
  const idle = useRef<(() => void)[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const settle = useCallback(() => {
    if (running.current || waiting.current.length || timers.current.size) return;
    setStatus(failed.current.length ? "failed" : "saved");
    idle.current.splice(0).forEach((resolve) => resolve());
  }, []);

  const pump = useCallback(async () => {
    if (running.current) return;
    while (waiting.current.length) {
      const task = waiting.current.shift()!;
      running.current = task;
      setStatus("saving");
      let outcome: SaveOutcome;
      try {
        outcome = await task.run();
      } catch {
        // A Server Action that never reached the server (offline) rejects.
        outcome = "retry";
      }
      running.current = null;
      failed.current = failed.current.filter((other) => other.key !== task.key);
      if (outcome === "retry") failed.current = [...failed.current, task];
    }
    settle();
  }, [settle]);

  const enqueue = useCallback(
    (task: SaveTask) => {
      const pending = timers.current.get(task.key);
      if (pending) {
        clearTimeout(pending.timer);
        timers.current.delete(task.key);
      }
      // A newer value of a failed field replaces the failed one.
      failed.current = failed.current.filter((other) => other.key !== task.key);
      const index = waiting.current.findIndex((other) => other.key === task.key);
      waiting.current =
        index === -1
          ? [...waiting.current, task]
          : waiting.current.map((other, i) => (i === index ? task : other));
      setStatus("saving");
      void pump();
    },
    [pump],
  );

  /** A text field: saved 800 ms after the last change, or at once by `flushField` on leave. */
  const enqueueLater = useCallback(
    (task: SaveTask) => {
      const pending = timers.current.get(task.key);
      if (pending) clearTimeout(pending.timer);
      const timer = setTimeout(() => {
        timers.current.delete(task.key);
        enqueue(task);
      }, TEXT_SAVE_DELAY_MS);
      timers.current.set(task.key, { task, timer });
      setStatus("saving");
    },
    [enqueue],
  );

  const flushField = useCallback(
    (key: string) => {
      const pending = timers.current.get(key);
      if (pending) enqueue(pending.task);
    },
    [enqueue],
  );

  /** A removed line's waiting and failed saves go with it. */
  const dropLine = useCallback(
    (lineId: string) => {
      waiting.current = waiting.current.filter((task) => task.lineId !== lineId);
      failed.current = failed.current.filter((task) => task.lineId !== lineId);
      for (const [key, { task, timer }] of timers.current) {
        if (task.lineId === lineId) {
          clearTimeout(timer);
          timers.current.delete(key);
        }
      }
      settle();
    },
    [settle],
  );

  const retry = useCallback(() => {
    if (failed.current.length === 0) return;
    waiting.current = [...failed.current, ...waiting.current];
    failed.current = [];
    void pump();
  }, [pump]);

  /** True while a newer edit of this line waits, so an older reply must not overwrite it. */
  const lineHasWaiting = useCallback(
    (lineId: string) =>
      waiting.current.some((task) => task.lineId === lineId) ||
      [...timers.current.values()].some(({ task }) => task.lineId === lineId),
    [],
  );

  /** Something is not saved yet: waiting, running, typed, or failed. */
  const hasUnsaved = useCallback(
    () =>
      !!running.current ||
      waiting.current.length > 0 ||
      timers.current.size > 0 ||
      failed.current.length > 0,
    [],
  );

  /** Sends every typed field now and resolves once nothing is waiting or running. */
  const flush = useCallback((): Promise<{ readonly failed: boolean }> => {
    for (const { task, timer } of timers.current.values()) {
      clearTimeout(timer);
      waiting.current = [...waiting.current.filter((t) => t.key !== task.key), task];
    }
    timers.current.clear();
    void pump();
    return new Promise((resolve) => {
      const done = () => resolve({ failed: failed.current.length > 0 });
      if (!running.current && waiting.current.length === 0) done();
      else idle.current.push(done);
    });
  }, [pump]);

  useEffect(() => {
    const online = () => retry();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [retry]);

  // Leaving the page with something unsaved asks first.
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsaved()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasUnsaved]);

  useEffect(
    () => () => {
      for (const { timer } of timers.current.values()) clearTimeout(timer);
    },
    [],
  );

  return {
    status,
    enqueue,
    enqueueLater,
    flushField,
    dropLine,
    retry,
    flush,
    lineHasWaiting,
    hasUnsaved,
  };
}

export type SaveQueue = ReturnType<typeof useSaveQueue>;
