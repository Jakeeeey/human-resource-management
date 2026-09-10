// orientationPredicate.ts — plug orientation into Todo 5's status machine
// + Todo 14's completion orchestrator.
//
// Same predicate shape: `StageEvidence.orientationDone`. This module never
// reshapes the machine — it imports the evidence TYPE only and feeds the
// `orientationDone` flag from the Todo 11 store predicate
// (`isOrientationDone`). The machine's `isStageDone` / `checkTransition`
// keep sole ownership of gating.

import type { StageEvidence } from "../hub/statusMachine";
import { isOrientationDone } from "./orientationStore";

/** Orientation flag for a hire, in machine evidence shape. */
export function orientationEvidenceFor(profileId: number): Pick<StageEvidence, "orientationDone"> {
  return { orientationDone: isOrientationDone(profileId) };
}

/** Merge the orientation flag into a base evidence object (pure). */
export function applyOrientationEvidence(
  base: StageEvidence,
  profileId: number
): StageEvidence {
  return { ...base, orientationDone: isOrientationDone(profileId) };
}
