import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    CONDITION_OPERATOR_LABELS,
    summariseConditions,
} from "./ms-condition-labels.ts";

describe("CONDITION_OPERATOR_LABELS", () => {
    it("covers every operator with plain-language text", () => {
        assert.deepEqual(CONDITION_OPERATOR_LABELS, {
            equals: "is",
            not_equals: "is not",
            in: "is one of",
            not_in: "is not one of",
            is_set: "has a value",
            is_empty: "is empty",
        });
    });
});

describe("summariseConditions catch-all", () => {
    it("renders null as a catch-all", () => {
        assert.equal(summariseConditions(null), "Always matches");
    });
    it("renders an empty array as a catch-all", () => {
        assert.equal(summariseConditions([]), "Always matches");
    });
});

describe("summariseConditions single condition", () => {
    it("renders equals with a quoted value", () => {
        assert.equal(
            summariseConditions([{ field: "position", op: "equals", value: "Developer" }]),
            'position is "Developer"',
        );
    });
    it("renders not_equals with a quoted value", () => {
        assert.equal(
            summariseConditions([{ field: "position", op: "not_equals", value: "QA" }]),
            'position is not "QA"',
        );
    });
    it("renders numeric values without quotes", () => {
        assert.equal(
            summariseConditions([{ field: "score", op: "equals", value: 10 }]),
            "score is 10",
        );
    });
});

describe("summariseConditions several conditions", () => {
    it("joins conditions with and", () => {
        assert.equal(
            summariseConditions([
                { field: "position", op: "equals", value: "Developer" },
                { field: "level", op: "not_equals", value: "Intern" },
            ]),
            'position is "Developer" and level is not "Intern"',
        );
    });
});

describe("summariseConditions list operators", () => {
    it("renders in as a quoted list", () => {
        assert.equal(
            summariseConditions([{ field: "position", op: "in", value: ["Developer", "QA"] }]),
            'position is one of "Developer", "QA"',
        );
    });
    it("renders not_in as a quoted list", () => {
        assert.equal(
            summariseConditions([{ field: "position", op: "not_in", value: ["Intern"] }]),
            'position is not one of "Intern"',
        );
    });
});

describe("summariseConditions valueless operators", () => {
    it("renders is_set without a value", () => {
        assert.equal(
            summariseConditions([{ field: "nickname", op: "is_set" }]),
            "nickname has a value",
        );
    });
    it("renders is_empty without a value", () => {
        assert.equal(
            summariseConditions([{ field: "nickname", op: "is_empty" }]),
            "nickname is empty",
        );
    });
});

describe("summariseConditions malformed input", () => {
    it("renders an unknown operator as invalid", () => {
        assert.equal(
            summariseConditions([{ field: "a", op: "gt", value: 1 }]),
            "Invalid rule",
        );
    });
    it("renders a non-record element as invalid", () => {
        assert.equal(summariseConditions([42]), "Invalid rule");
    });
    it("renders a missing field as invalid", () => {
        assert.equal(summariseConditions([{ op: "equals", value: "x" }]), "Invalid rule");
    });
    it("renders a scalar in value as invalid", () => {
        assert.equal(
            summariseConditions([{ field: "a", op: "in", value: "x" }]),
            "Invalid rule",
        );
    });
    it("renders a plain string as invalid", () => {
        assert.equal(summariseConditions("hello"), "Invalid rule");
    });
    it("never throws on hostile input", () => {
        assert.doesNotThrow(() => summariseConditions(7));
        assert.doesNotThrow(() => summariseConditions(true));
        assert.doesNotThrow(() => summariseConditions({}));
    });
    it("never emits JSON", () => {
        const outputs = [
            summariseConditions(null),
            summariseConditions([]),
            summariseConditions([{ field: "position", op: "equals", value: "Developer" }]),
            summariseConditions([{ field: "position", op: "in", value: ["Developer", "QA"] }]),
            summariseConditions([{ field: "nickname", op: "is_empty" }]),
            summariseConditions("hello"),
        ];
        for (const output of outputs) {
            assert.equal(output.includes("{"), false);
            assert.equal(output.includes("["), false);
        }
    });
});
