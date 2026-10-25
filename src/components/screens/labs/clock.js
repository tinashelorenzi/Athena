'use client';
import { useSyncExternalStore } from 'react';

/* A 1-second clock for countdowns and "last seen" without calling Date.now()
   during render. Null on the server, so nothing time-based is prerendered. */
const clockListeners = new Set();
let clockTimer = null;
function subscribeClock(cb) {
  clockListeners.add(cb);
  if (!clockTimer) clockTimer = setInterval(() => clockListeners.forEach((l) => l()), 1000);
  return () => {
    clockListeners.delete(cb);
    if (!clockListeners.size) { clearInterval(clockTimer); clockTimer = null; }
  };
}
export const useNow = () => useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / 1000) * 1000, () => null);
const subscribeNothing = () => () => {};
export const useOrigin = () => useSyncExternalStore(subscribeNothing, () => window.location.origin, () => '');

