/**
 * A parser turns raw text from the agent (a file's content, a command's
 * stdout) into JSON for CEL assertions (docs/labs/spec.md 9.6). Parsers run
 * only in Athena; adding one never needs an agent release.
 */
export type Parser = {
  name: string;
  /** Bump when output changes shape or meaning; recorded in each grading run. */
  version: number;
  description: string;
  /** Option names this parser accepts (anything else is a compile error). */
  options: string[];
  /** Compile-time check of the options; returns an error message or null. */
  validate?: (opts: Record<string, unknown>) => string | null;
  parse: (text: string, opts: Record<string, unknown>) => unknown;
};

export class ParseError extends Error {}
