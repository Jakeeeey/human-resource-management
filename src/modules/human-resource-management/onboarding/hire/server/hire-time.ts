// hire-time.ts — PH-time producers for the post-hire orchestrator family.
// conventions.md §6: audit/event timestamps are written in Philippine time
// (`sv-SE` yields the MySQL-compatible 'YYYY-MM-DD HH:mm:ss' shape) and never
// by a DB default. Kept local to the hire module so the orchestrator does not
// reach into the signing module just for a clock.

/**
 * @returns Current Philippine wall time as 'YYYY-MM-DD HH:mm:ss'.
 */
export function philippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

/**
 * @returns Current Philippine date as 'YYYY-MM-DD'.
 */
export function philippineDate(): string {
  return philippineTime().slice(0, 10);
}
