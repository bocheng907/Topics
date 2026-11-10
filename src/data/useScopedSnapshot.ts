import { useCallback, useEffect, useState } from "react";

export type SnapshotStatus = "idle" | "loading" | "cached" | "ready" | "error";
type Settled<T> = { identity: string; attempt: number; status: "cached" | "ready" | "error"; data?: T };
type Subscribe<T> = (onData: (data: T, fromCache?: boolean) => void, onError: () => void) => () => void;

/** Keep cache, confirmed empty and failure distinct, including after account changes. */
export function useScopedSnapshot<T>(scope: string | null, ready: boolean, subscribe: Subscribe<T>) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const identity = JSON.stringify([ready, scope]);
  const [previousIdentity, setPreviousIdentity] = useState(identity);
  if (previousIdentity !== identity) {
    setPreviousIdentity(identity);
    setSettled(null);
  }

  const retry = useCallback(() => {
    setSettled(null);
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    if (!ready || !scope) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopTimer = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const fail = () => {
      stopTimer();
      if (!active) return;
      setSettled(previous => ({
        identity, attempt, status: "error",
        ...(previous?.identity === identity && previous.attempt === attempt && "data" in previous
          ? { data: previous.data } : {}),
      }));
    };
    const startTimer = () => {
      if (timer === undefined) timer = setTimeout(fail, 20000);
    };
    startTimer();
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribe((data, fromCache = false) => {
        if (!active) return;
        if (fromCache) startTimer();
        else stopTimer();
        setSettled({ identity, attempt, status: fromCache ? "cached" : "ready", data });
      }, () => {
        fail();
      });
    } catch {
      fail();
    }
    return () => { active = false; stopTimer(); unsubscribe(); };
  }, [ready, scope, identity, attempt, subscribe]);

  const current = settled?.identity === identity && settled.attempt === attempt ? settled : null;
  const status: SnapshotStatus = !ready ? "loading" : !scope ? "idle" : current?.status ?? "loading";
  return { status, data: current && status !== "loading" ? current.data ?? null : null, retry };
}
