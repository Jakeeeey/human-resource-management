// equipmentPredicate.ts — FULLY_EQUIPPED predicate.
//
// Pure logic — zero runtime imports, safe for route + client + harness use
// (Node 24 type-stripping runs this file directly). This is THE single
// definition consumed by the equipment-status route and the completion
// orchestrator: all required catalog items issued AND acked → equipped.
//
// Store mapping (`acknowledgement_logs`, 9 fields), keyed to the employee
// (`user.user_id`):
// - issue row: doc_ref `equipment:issue:<userId>:<itemKey>`,
//   signer `issuer:<role>`, method `typed` (HR typed handover entry).
// - ack row: doc_ref `equipment:ack:<userId>:<itemKey>`,
//   signer `hiree:<userId>` (the employee themself) or `hr-override:<userId>`,
//   method ink|stamp|typed. Ack-without-issue never counts (routes reject it
//   with 422; the predicate additionally requires issue presence defensively).

export type EquipmentEventKind = "issue" | "ack";

export interface ParsedEquipmentDocRef {
  kind: EquipmentEventKind;
  userId: number;
  itemKey: string;
}

export interface EquipmentCatalogEntry {
  key: string;
  required: boolean;
}

export interface EquipmentItemState {
  itemKey: string;
  required: boolean;
  issued: boolean;
  acked: boolean;
}

/** Composes the namespaced doc_ref for an equipment event row. */
export function equipmentDocRef(
  kind: EquipmentEventKind,
  userId: number,
  itemKey: string
): string {
  return `equipment:${kind}:${userId}:${itemKey}`;
}

/**
 * Parses an equipment doc_ref back into its parts.
 * Returns null for rows that are not equipment events (e.g. paperwork doc
 * rows share the store — different namespace, ignored here).
 */
export function parseEquipmentDocRef(
  docRef: unknown
): ParsedEquipmentDocRef | null {
  if (typeof docRef !== "string") return null;
  const parts = docRef.split(":");
  if (parts.length !== 4) return null;
  const [ns, kind, userIdRaw, itemKey] = parts;
  if (ns !== "equipment") return null;
  if (kind !== "issue" && kind !== "ack") return null;
  if (!/^\d+$/.test(userIdRaw ?? "")) return null;
  if (!/^[a-z0-9_]{1,64}$/.test(itemKey ?? "")) return null;
  return {
    kind: kind as EquipmentEventKind,
    userId: Number(userIdRaw),
    itemKey: itemKey as string,
  };
}

/** Composes the hiree ack signer for the employee key (`user.user_id`). */
export function hireeSigner(userId: number): string {
  return `hiree:${userId}`;
}

/** Composes the issuer signer for a §9 issuer role. */
export function issuerSigner(role: string): string {
  return `issuer:${role.toLowerCase()}`;
}

/**
 * Builds per-item issue/ack state for one employee from raw store doc_refs.
 * Only rows parsing to this userId count; unknown item keys are ignored
 * (catalogue membership is enforced at write time with 400).
 */
export function buildEquipmentItemStates(
  userId: number,
  catalog: readonly EquipmentCatalogEntry[],
  docRefs: readonly unknown[]
): EquipmentItemState[] {
  const issued = new Set<string>();
  const acked = new Set<string>();
  for (const ref of docRefs) {
    const parsed = parseEquipmentDocRef(ref);
    if (!parsed || parsed.userId !== userId) continue;
    if (parsed.kind === "issue") issued.add(parsed.itemKey);
    else acked.add(parsed.itemKey);
  }
  return catalog.map((entry) => ({
    itemKey: entry.key,
    required: entry.required,
    issued: issued.has(entry.key),
    // An ack only counts when its issue exists (ack-without-issue is
    // rejected at write time; this keeps the predicate safe under it).
    acked: acked.has(entry.key) && issued.has(entry.key),
  }));
}

/**
 * FULLY_EQUIPPED — true iff every REQUIRED catalog item is issued AND
 * acked. Vacuous truth is excluded: an empty required set answers false
 * (a hire with nothing required is misconfigured, never equipped).
 */
export function isFullyEquipped(states: readonly EquipmentItemState[]): boolean {
  const required = states.filter((s) => s.required);
  if (required.length === 0) return false;
  return required.every((s) => s.issued && s.acked);
}

/**
 * Projects predicate state onto Todo 5's StageEvidence shape
 * (`{ equipmentDone }` merges via spread — no statusMachine edit needed).
 */
export function toEquipmentEvidence(
  states: readonly EquipmentItemState[]
): { equipmentDone: boolean } {
  return { equipmentDone: isFullyEquipped(states) };
}
