/**
 * The operating systems lab machines can run (docs/labs/kali.md). A lab role
 * asks for one in lab.yaml (`os: ubuntu`, `os: kali` or `os: any`), and a
 * machine reports its os-release ID and VERSION_ID when it enrols.
 */

export const LAB_OSES = ["ubuntu", "kali"] as const;
export type LabOs = (typeof LAB_OSES)[number];
/** What a role can ask for: one OS, or any supported one. */
export const ROLE_OSES = [...LAB_OSES, "any"] as const;

const NAMES: Record<string, string> = { ubuntu: "Ubuntu", kali: "Kali Linux", any: "Ubuntu or Kali Linux" };

/** "Ubuntu", "Kali Linux"; an unknown ID as it is. */
export const osName = (os: string) => NAMES[os] ?? os;

/** "Ubuntu 24.04", "Kali Linux 2025.3". */
export const osLabel = (os: string, version: string) => [osName(os), version].filter(Boolean).join(" ");

/**
 * Whether a machine's version is one the role lists: the same version, or one
 * under it ("2025" covers Kali 2025.1–2025.4, "24" covers Ubuntu 24.04).
 */
export const versionMatches = (versions: string[], version: string) =>
  !versions.length || versions.some((v) => version === v || version.startsWith(`${v}.`));

/** Why a machine can't fill a role, or null if it can. */
export function roleMismatch(role: string, spec: { os: string; versions: string[] }, machine: { label: string; os: string; osVersion: string }): string | null {
  const os = spec.os || "ubuntu";
  const runs = osLabel(machine.os, machine.osVersion);
  if (os === "any" ? !(LAB_OSES as readonly string[]).includes(machine.os) : machine.os !== os) {
    const name = osName(os);
    return `"${role}" needs ${/^[AEIOU]/.test(name) ? "an" : "a"} ${name} machine; ${machine.label} runs ${runs}.`;
  }
  if (!versionMatches(spec.versions, machine.osVersion)) {
    return `"${role}" needs ${osName(os === "any" ? machine.os : os)} ${spec.versions.join(" or ")}; ${machine.label} runs ${runs}.`;
  }
  return null;
}
