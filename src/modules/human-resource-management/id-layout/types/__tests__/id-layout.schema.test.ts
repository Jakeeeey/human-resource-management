import { test } from "node:test";
import assert from "node:assert/strict";
import { idDocSchema } from "../id-layout.schema";
import { validDoc } from "../../__fixtures__/valid-doc";
import {
    brokenZOrderDoc,
    danglingRootIdDoc,
    doubleFrontDoc,
    doubleMemberedDoc,
    nonStageParentDoc,
    onePageDoc,
    orphanNodeDoc,
    threePageDoc,
    unknownVariableFieldDoc,
    versionOneDoc,
    wrongCardDimsDoc,
} from "../../__fixtures__/reject-docs";

test("accepts a valid two-page id document", () => {
    assert.equal(idDocSchema.safeParse(validDoc()).success, true);
});

test("rejects version 1", () => {
    assert.equal(idDocSchema.safeParse(versionOneDoc()).success, false);
});

test("rejects a one-page document", () => {
    assert.equal(idDocSchema.safeParse(onePageDoc()).success, false);
});

test("rejects a three-page document", () => {
    assert.equal(idDocSchema.safeParse(threePageDoc()).success, false);
});

test("rejects two front pages", () => {
    assert.equal(idDocSchema.safeParse(doubleFrontDoc()).success, false);
});

test("rejects an orphan node", () => {
    assert.equal(idDocSchema.safeParse(orphanNodeDoc()).success, false);
});

test("rejects a doubly-membered node", () => {
    assert.equal(idDocSchema.safeParse(doubleMemberedDoc()).success, false);
});

test("rejects a dangling rootId", () => {
    assert.equal(idDocSchema.safeParse(danglingRootIdDoc()).success, false);
});

test("rejects a non-stage parent", () => {
    assert.equal(idDocSchema.safeParse(nonStageParentDoc()).success, false);
});

test("rejects wrong card dimensions", () => {
    assert.equal(idDocSchema.safeParse(wrongCardDimsDoc()).success, false);
});

test("rejects an unknown variable field", () => {
    assert.equal(idDocSchema.safeParse(unknownVariableFieldDoc()).success, false);
});

test("rejects a z-permutation violation", () => {
    assert.equal(idDocSchema.safeParse(brokenZOrderDoc()).success, false);
});
