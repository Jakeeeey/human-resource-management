import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { parseUtcInstant, formatPHT, formatDateOnly, phLocalToUtcIso, phToday } from "./time.ts";

describe("parseUtcInstant", () => {
    test("returns null for empty input", () => {
        assert.equal(parseUtcInstant(null), null);
        assert.equal(parseUtcInstant(undefined), null);
        assert.equal(parseUtcInstant(""), null);
    });

    test("reads an ISO value with Z as that exact moment", () => {
        assert.equal(parseUtcInstant("2026-09-25T01:30:00Z")?.toISOString(), "2026-09-25T01:30:00.000Z");
    });

    test("respects an explicit offset", () => {
        assert.equal(parseUtcInstant("2026-09-25T09:30:00+08:00")?.toISOString(), "2026-09-25T01:30:00.000Z");
    });

    test("treats a value with no zone as UTC (this is how Directus returns datetime columns)", () => {
        assert.equal(parseUtcInstant("2026-09-25T01:30:00")?.toISOString(), "2026-09-25T01:30:00.000Z");
        assert.equal(parseUtcInstant("2026-09-25 01:30:00")?.toISOString(), "2026-09-25T01:30:00.000Z");
    });

    test("does not treat a calendar date as a moment", () => {
        assert.equal(parseUtcInstant("2026-09-25"), null);
    });

    test("returns null for garbage and for an invalid Date", () => {
        assert.equal(parseUtcInstant("soon"), null);
        assert.equal(parseUtcInstant(new Date("nope")), null);
    });

    test("passes a valid Date through", () => {
        const d = new Date("2026-09-25T01:30:00Z");
        assert.equal(parseUtcInstant(d)?.getTime(), d.getTime());
    });
});

describe("formatPHT", () => {
    test("shows a UTC moment in Philippine time", () => {
        assert.equal(formatPHT("2026-09-25T01:30:00Z"), "Sep 25, 2026 9:30 AM");
    });

    test("treats a zone-less stored value as UTC, so datetime and timestamp columns read the same", () => {
        assert.equal(formatPHT("2026-09-25T01:30:00"), "Sep 25, 2026 9:30 AM");
        assert.equal(formatPHT("2026-09-25 01:30:00"), "Sep 25, 2026 9:30 AM");
    });

    test("rolls into the next Manila day", () => {
        assert.equal(formatPHT("2026-09-24T17:00:00Z"), "Sep 25, 2026 1:00 AM");
    });

    test("12-hour clock edges: noon and midnight", () => {
        assert.equal(formatPHT("2026-09-25T04:00:00Z"), "Sep 25, 2026 12:00 PM");
        assert.equal(formatPHT("2026-09-24T16:00:00Z"), "Sep 25, 2026 12:00 AM");
    });

    test("can show the date only", () => {
        assert.equal(formatPHT("2026-09-25T01:30:00Z", { includeTime: false }), "Sep 25, 2026");
    });

    test("shows a dash for empty, garbage, or date-only input", () => {
        assert.equal(formatPHT(null), "—");
        assert.equal(formatPHT("soon"), "—");
        assert.equal(formatPHT("2026-09-25"), "—");
    });
});

describe("formatDateOnly", () => {
    test("shows a calendar date exactly as stored, never shifted", () => {
        assert.equal(formatDateOnly("2026-09-22"), "Sep 22, 2026");
        assert.equal(formatDateOnly("2026-01-01"), "Jan 1, 2026");
    });

    test("shows a dash for empty or malformed input", () => {
        assert.equal(formatDateOnly(null), "—");
        assert.equal(formatDateOnly("22/09/2026"), "—");
    });
});

describe("phLocalToUtcIso", () => {
    test("converts a Manila date-time picked in the browser to UTC", () => {
        assert.equal(phLocalToUtcIso("2026-09-25T09:30"), "2026-09-25T01:30:00Z");
    });

    test("Manila midnight is 16:00 UTC the day before", () => {
        assert.equal(phLocalToUtcIso("2026-09-25T00:00"), "2026-09-24T16:00:00Z");
    });

    test("keeps seconds when given", () => {
        assert.equal(phLocalToUtcIso("2026-09-25T09:30:45"), "2026-09-25T01:30:45Z");
    });

    test("returns null for empty, non-datetime, or impossible input", () => {
        assert.equal(phLocalToUtcIso(""), null);
        assert.equal(phLocalToUtcIso(null), null);
        assert.equal(phLocalToUtcIso("soon"), null);
        assert.equal(phLocalToUtcIso("2026-09-25"), null);
        assert.equal(phLocalToUtcIso("2026-02-30T10:00"), null);
        assert.equal(phLocalToUtcIso("2026-09-25T25:61"), null);
    });

    test("round trip: what the user picked is what is shown back", () => {
        assert.equal(formatPHT(phLocalToUtcIso("2026-09-25T09:30")), "Sep 25, 2026 9:30 AM");
    });
});

describe("phToday", () => {
    afterEach(() => mock.timers.reset());

    test("is today's date in Manila, not in UTC", () => {
        mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-24T17:00:00Z") });
        assert.equal(phToday(), "2026-09-25");
    });

    test("stays on the same day early in the Manila morning UTC-wise", () => {
        mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-25T01:00:00Z") });
        assert.equal(phToday(), "2026-09-25");
    });
});
