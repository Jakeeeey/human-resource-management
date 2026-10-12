import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isAssignmentOverdue } from "./trainingAssignmentAdapter.ts";
import { CreateTrainingAssignmentSchema } from "./types/training-taking.schema.ts";

describe("isAssignmentOverdue", () => {
    const due = "2026-09-25T01:30:00Z";

    test("a completed assignment is never overdue", () => {
        assert.equal(isAssignmentOverdue({ status: "completed", due }, "2027-01-01T00:00:00Z"), false);
    });

    test("no deadline is never overdue", () => {
        assert.equal(isAssignmentOverdue({ status: "assigned", due: null }, "2027-01-01T00:00:00Z"), false);
    });

    test("compares real moments: one second before the deadline is fine, one second after is overdue", () => {
        assert.equal(isAssignmentOverdue({ status: "assigned", due }, "2026-09-25T01:29:59Z"), false);
        assert.equal(isAssignmentOverdue({ status: "in_progress", due }, "2026-09-25T01:30:01Z"), true);
    });

    test("a deadline as Directus returns it (no Z) is read as UTC", () => {
        assert.equal(isAssignmentOverdue({ status: "assigned", due: "2026-09-25T01:30:00" }, "2026-09-25T01:29:59Z"), false);
        assert.equal(isAssignmentOverdue({ status: "assigned", due: "2026-09-25T01:30:00" }, "2026-09-25T01:30:01Z"), true);
    });

    test("regression: the deadline day is not overdue from midnight", () => {
        assert.equal(isAssignmentOverdue({ status: "assigned", due: "2026-09-25 09:30:00" }, "2026-09-25T00:10:00Z"), false);
    });

    test("an unreadable deadline cannot make an assignment overdue", () => {
        assert.equal(isAssignmentOverdue({ status: "assigned", due: "soon" }, "2027-01-01T00:00:00Z"), false);
    });
});

describe("CreateTrainingAssignmentSchema: due", () => {
    const base = { user_id: 1, quiz_id: 2 };
    const ok = (due) => CreateTrainingAssignmentSchema.safeParse({ ...base, due }).success;

    test("accepts an ISO UTC moment, null, or no deadline at all", () => {
        assert.equal(ok("2026-09-25T01:30:00Z"), true);
        assert.equal(ok(null), true);
        assert.equal(CreateTrainingAssignmentSchema.safeParse(base).success, true);
    });

    test("rejects free text and anything that is not a full UTC moment", () => {
        assert.equal(ok("soon"), false);
        assert.equal(ok("2026-09-25 09:30:00"), false);
        assert.equal(ok("2026-09-25"), false);
        assert.equal(ok(""), false);
    });
});
