import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { actorIdFromJwt, stampCreate, stampUpdate, nowPH, nowUTC, creationTimestamps } from "./audit.ts";

describe("actorIdFromJwt", () => {
    test("returns null when there is no payload", () => {
        assert.equal(actorIdFromJwt(null), null);
        assert.equal(actorIdFromJwt(undefined), null);
    });

    test("returns null when the payload carries no id claim", () => {
        assert.equal(actorIdFromJwt({ email: "a@b.c" }), null);
    });

    test("prefers id, then user_id, then sub", () => {
        assert.equal(actorIdFromJwt({ id: 7, user_id: 8, sub: "9" }), 7);
        assert.equal(actorIdFromJwt({ user_id: 8, sub: "9" }), 8);
        assert.equal(actorIdFromJwt({ sub: "9" }), 9);
    });

    test("coerces a numeric string to a number", () => {
        assert.equal(actorIdFromJwt({ sub: "24" }), 24);
    });

    test("returns null when the claim is not numeric", () => {
        assert.equal(actorIdFromJwt({ sub: "not-a-number" }), null);
    });
});

describe("stampCreate", () => {
    test("returns the row untouched when there is no actor", () => {
        const row = { name: "x" };
        assert.equal(stampCreate(row, null), row);
        assert.deepEqual(row, { name: "x" });
    });

    test("stamps created_by only: updated_by stays empty until the first edit", () => {
        const stamped = stampCreate({ name: "x" }, 5);
        assert.deepEqual(stamped, { name: "x", created_by: 5 });
        assert.equal("updated_by" in stamped, false);
    });

    test("does not mutate the input row", () => {
        const row = { name: "x" };
        stampCreate(row, 5);
        assert.deepEqual(row, { name: "x" });
    });

    test("never adds or changes timestamps", () => {
        const stamped = stampCreate({ created_at: "A", updated_at: "B" }, 5);
        assert.equal(stamped.created_at, "A");
        assert.equal(stamped.updated_at, "B");
        assert.deepEqual(Object.keys(stampCreate({}, 5)), ["created_by"]);
    });
});

describe("stampUpdate", () => {
    test("returns the row untouched when there is no actor", () => {
        const row = { name: "x" };
        assert.equal(stampUpdate(row, null), row);
    });

    test("stamps updated_by only, never created_by", () => {
        assert.deepEqual(stampUpdate({ name: "x" }, 5), { name: "x", updated_by: 5 });
    });

    test("does not mutate the input row", () => {
        const row = { name: "x" };
        stampUpdate(row, 5);
        assert.deepEqual(row, { name: "x" });
    });
});

describe("nowPH", () => {
    afterEach(() => mock.timers.reset());

    test("is Philippine wall time, MySQL-shaped with no offset", () => {
        mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-24T01:43:27Z") });
        assert.equal(nowPH(), "2026-09-24 09:43:27");
        assert.match(nowPH(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    test("rolls over to the next calendar day at 16:00 UTC", () => {
        mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-23T17:00:00Z") });
        assert.equal(nowPH(), "2026-09-24 01:00:00");
    });
});

describe("nowUTC", () => {
    afterEach(() => mock.timers.reset());

    test("is the current moment in UTC, ISO 8601 with a Z", () => {
        mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-24T01:43:27Z") });
        assert.equal(nowUTC(), "2026-09-24T01:43:27Z");
    });

    test("truncates milliseconds instead of rounding them into the next second", () => {
        mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-24T01:43:27.999Z") });
        assert.equal(nowUTC(), "2026-09-24T01:43:27Z");
    });

    test("is not shifted to Philippine time", () => {
        mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-23T17:00:00Z") });
        assert.equal(nowUTC(), "2026-09-23T17:00:00Z");
        assert.notEqual(nowUTC().slice(0, 10), nowPH().slice(0, 10));
    });
});

describe("creationTimestamps", () => {
    afterEach(() => mock.timers.reset());

    test("created_at is the given moment; updated_at is null until the first edit", () => {
        assert.deepEqual(creationTimestamps("2026-09-25T01:30:00Z"), { created_at: "2026-09-25T01:30:00Z", updated_at: null });
    });

    test("defaults to the current UTC moment", () => {
        mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-24T01:43:27Z") });
        assert.deepEqual(creationTimestamps(), { created_at: "2026-09-24T01:43:27Z", updated_at: null });
    });
});
