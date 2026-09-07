/**
 * Thrown when a domain declines to judge: a register, a probe or a report it
 * could not read, a tier it could not plan, a run it cannot judge. A refusal
 * is not a verdict — it has no `ok` — and every domain throws this one class
 * so that a caller catches one type and maps it to the one exit code
 * `refused` names, rather than four types to one code, with the fourth arm
 * the one that gets forgotten. The message says what was declined and why.
 */
export default class Refusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Refusal";
  }
}
