/* Instructor-facing explanations of session flags. Lab-defined flags (from
   `flag:` checks) are described by their check's title. Flags are signals for
   a human to look at, never verdicts (docs/labs/spec.md 13). */
export const SYSTEM_FLAGS = {
  SSH_DURING_LOCKDOWN: 'SSH was used while it should have been off: a login during the session, or a connection left open from before the start.',
  LOCKDOWN_TAMPERED: 'SSH was switched back on, or the agent’s undo record was removed, during the session.',
  MACHINE_SHARED: 'The same VM is also enrolled by another student.',
};

export function flagInfo(code, definition) {
  if (SYSTEM_FLAGS[code]) return SYSTEM_FLAGS[code];
  const check = definition?.checks?.find((c) => c.flag === code);
  return check ? `Raised by the check “${check.title}” failing.` : 'A flag raised by this lab.';
}
