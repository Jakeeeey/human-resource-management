import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "./paginate.ts";

const rows = (n) => Array.from({ length: n }, (_, i) => i + 1);

test("page size options match the other screens and the default is one of them", () => {
    assert.deepEqual([...PAGE_SIZE_OPTIONS], [10, 25, 50, 100]);
    assert.ok(PAGE_SIZE_OPTIONS.includes(DEFAULT_PAGE_SIZE));
});

test("no rows: one empty page, range 0-0", () => {
    const r = paginate([], 1, 10);
    assert.deepEqual(r.pageItems, []);
    assert.equal(r.page, 1);
    assert.equal(r.totalPages, 1);
    assert.equal(r.total, 0);
    assert.equal(r.rangeStart, 0);
    assert.equal(r.rangeEnd, 0);
});

test("first page of 25 rows at size 10", () => {
    const r = paginate(rows(25), 1, 10);
    assert.deepEqual(r.pageItems, rows(10));
    assert.equal(r.totalPages, 3);
    assert.equal(r.total, 25);
    assert.equal(r.rangeStart, 1);
    assert.equal(r.rangeEnd, 10);
});

test("last page holds the remainder", () => {
    const r = paginate(rows(25), 3, 10);
    assert.deepEqual(r.pageItems, [21, 22, 23, 24, 25]);
    assert.equal(r.rangeStart, 21);
    assert.equal(r.rangeEnd, 25);
});

test("exact multiple of the page size has no empty trailing page", () => {
    const r = paginate(rows(20), 2, 10);
    assert.equal(r.totalPages, 2);
    assert.deepEqual(r.pageItems, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
});

test("one row over the boundary spills onto a new page", () => {
    const r = paginate(rows(11), 2, 10);
    assert.equal(r.totalPages, 2);
    assert.deepEqual(r.pageItems, [11]);
});

test("a stale page index (dataset shrank) is clamped to the last page", () => {
    const r = paginate(rows(25), 5, 10);
    assert.equal(r.page, 3);
    assert.deepEqual(r.pageItems, [21, 22, 23, 24, 25]);
});

test("page 0, negative and NaN are clamped to page 1", () => {
    for (const bad of [0, -3, Number.NaN]) {
        const r = paginate(rows(25), bad, 10);
        assert.equal(r.page, 1);
        assert.equal(r.rangeStart, 1);
    }
});

test("a bigger page size collapses to fewer pages", () => {
    const r = paginate(rows(25), 1, 25);
    assert.equal(r.totalPages, 1);
    assert.equal(r.pageItems.length, 25);
    assert.equal(r.rangeEnd, 25);
});

test("changing the size mid-browse keeps the page valid", () => {
    const r = paginate(rows(25), 3, 50);
    assert.equal(r.page, 1);
    assert.equal(r.pageItems.length, 25);
});

test("an invalid page size falls back to the default instead of dividing by zero", () => {
    for (const bad of [0, -5, Number.NaN]) {
        const r = paginate(rows(25), 1, bad);
        assert.equal(r.pageItems.length, DEFAULT_PAGE_SIZE);
        assert.equal(r.totalPages, 3);
    }
});

test("does not mutate the input array", () => {
    const input = rows(15);
    const copy = [...input];
    paginate(input, 2, 10);
    assert.deepEqual(input, copy);
});
