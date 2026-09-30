import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONDITION_OPERATORS,
  evaluateRouting,
  extractConditionFields,
  matchCondition,
  parseConditions,
  sortEnabledBindings,
  validateConditionsForSchema,
} from "./routing-conditions.ts";

function binding(overrides = {}) {
  return {
    id: 1,
    template_id: 10,
    is_enabled: true,
    conditions: [],
    priority: null,
    ...overrides,
  };
}

describe("CONDITION_OPERATORS", () => {
  it("exposes exactly the six supported operators", () => {
    assert.deepEqual([...CONDITION_OPERATORS], [
      "equals",
      "not_equals",
      "in",
      "not_in",
      "is_set",
      "is_empty",
    ]);
  });
});

describe("parseConditions catch-all inputs", () => {
  it("maps null to an empty array", () => {
    assert.deepEqual(parseConditions(null), []);
  });
  it("maps undefined to an empty array", () => {
    assert.deepEqual(parseConditions(undefined), []);
  });
  it("maps an empty string to an empty array", () => {
    assert.deepEqual(parseConditions(""), []);
  });
  it("maps an empty array to an empty array", () => {
    assert.deepEqual(parseConditions([]), []);
  });
  it("maps the JSON string of an empty array to an empty array", () => {
    assert.deepEqual(parseConditions("[]"), []);
  });
});

describe("parseConditions well-formed input", () => {
  it("normalises an array of condition records", () => {
    assert.deepEqual(
      parseConditions([
        { field: "status", op: "equals", value: "active" },
        { field: "nickname", op: "is_set" },
      ]),
      [
        { field: "status", op: "equals", value: "active" },
        { field: "nickname", op: "is_set" },
      ],
    );
  });
  it("accepts a JSON string of condition records", () => {
    assert.deepEqual(parseConditions('[{"field":"a","op":"is_empty"}]'), [
      { field: "a", op: "is_empty" },
    ]);
  });
  it("drops unknown keys when normalising", () => {
    assert.deepEqual(
      parseConditions([{ field: "a", op: "is_set", extra: 1 }]),
      [{ field: "a", op: "is_set" }],
    );
  });
  it("accepts in with an array value", () => {
    assert.deepEqual(parseConditions([{ field: "a", op: "in", value: [1, 2] }]), [
      { field: "a", op: "in", value: [1, 2] },
    ]);
  });
  it("accepts a null value for equals", () => {
    assert.deepEqual(parseConditions([{ field: "a", op: "equals", value: null }]), [
      { field: "a", op: "equals", value: null },
    ]);
  });
});

describe("parseConditions malformed input fails closed", () => {
  it("rejects a plain string", () => {
    assert.equal(parseConditions("hello"), null);
  });
  it("rejects a plain object", () => {
    assert.equal(parseConditions({}), null);
  });
  it("rejects a non-record element", () => {
    assert.equal(parseConditions([42]), null);
  });
  it("rejects a record missing its field", () => {
    assert.equal(parseConditions([{ op: "equals" }]), null);
  });
  it("rejects an unknown operator", () => {
    assert.equal(parseConditions([{ op: "gt" }]), null);
  });
  it("rejects an unknown operator even with a field", () => {
    assert.equal(parseConditions([{ field: "a", op: "gt", value: 1 }]), null);
  });
  it("rejects an empty field", () => {
    assert.equal(parseConditions([{ field: "", op: "is_set" }]), null);
  });
  it("rejects a non-string field", () => {
    assert.equal(parseConditions([{ field: 42, op: "is_set" }]), null);
  });
  it("rejects equals without a value", () => {
    assert.equal(parseConditions([{ field: "a", op: "equals" }]), null);
  });
  it("rejects not_equals without a value", () => {
    assert.equal(parseConditions([{ field: "a", op: "not_equals" }]), null);
  });
  it("rejects a value carried by is_set", () => {
    assert.equal(parseConditions([{ field: "a", op: "is_set", value: "x" }]), null);
  });
  it("rejects a value carried by is_empty", () => {
    assert.equal(parseConditions([{ field: "a", op: "is_empty", value: null }]), null);
  });
  it("rejects a scalar value for in", () => {
    assert.equal(parseConditions([{ field: "a", op: "in", value: "x" }]), null);
  });
  it("rejects a missing value for not_in", () => {
    assert.equal(parseConditions([{ field: "a", op: "not_in" }]), null);
  });
  it("rejects a number", () => {
    assert.equal(parseConditions(7), null);
  });
  it("rejects a boolean", () => {
    assert.equal(parseConditions(true), null);
  });
});

describe("matchCondition equals", () => {
  it("matches a present equal value", () => {
    assert.equal(
      matchCondition({ field: "a", op: "equals", value: "x" }, { a: "x" }),
      true,
    );
  });
  it("rejects a present unequal value", () => {
    assert.equal(
      matchCondition({ field: "a", op: "equals", value: "x" }, { a: "y" }),
      false,
    );
  });
  it("rejects an absent field", () => {
    assert.equal(matchCondition({ field: "a", op: "equals", value: "x" }, {}), false);
  });
  it("matches null against null", () => {
    assert.equal(
      matchCondition({ field: "a", op: "equals", value: null }, { a: null }),
      true,
    );
  });
  it("matches an empty string against an empty string", () => {
    assert.equal(matchCondition({ field: "a", op: "equals", value: "" }, { a: "" }), true);
  });
  it("rejects strict type mismatches", () => {
    assert.equal(matchCondition({ field: "a", op: "equals", value: 10 }, { a: "10" }), false);
  });
  it("rejects number versus boolean", () => {
    assert.equal(matchCondition({ field: "a", op: "equals", value: 1 }, { a: true }), false);
  });
});

describe("matchCondition not_equals", () => {
  it("matches a present unequal value", () => {
    assert.equal(
      matchCondition({ field: "a", op: "not_equals", value: "x" }, { a: "y" }),
      true,
    );
  });
  it("rejects a present equal value", () => {
    assert.equal(
      matchCondition({ field: "a", op: "not_equals", value: "x" }, { a: "x" }),
      false,
    );
  });
  it("rejects an absent field", () => {
    assert.equal(
      matchCondition({ field: "a", op: "not_equals", value: "x" }, {}),
      false,
    );
  });
  it("rejects null against null", () => {
    assert.equal(
      matchCondition({ field: "a", op: "not_equals", value: null }, { a: null }),
      false,
    );
  });
  it("matches across strict type mismatches", () => {
    assert.equal(
      matchCondition({ field: "a", op: "not_equals", value: 10 }, { a: "10" }),
      true,
    );
  });
});

describe("matchCondition in", () => {
  it("matches a present contained value", () => {
    assert.equal(
      matchCondition({ field: "a", op: "in", value: ["x", "y"] }, { a: "y" }),
      true,
    );
  });
  it("rejects a present uncontained value", () => {
    assert.equal(
      matchCondition({ field: "a", op: "in", value: ["x", "y"] }, { a: "z" }),
      false,
    );
  });
  it("rejects an absent field", () => {
    assert.equal(matchCondition({ field: "a", op: "in", value: ["x"] }, {}), false);
  });
  it("matches null when the array contains null", () => {
    assert.equal(
      matchCondition({ field: "a", op: "in", value: [null] }, { a: null }),
      true,
    );
  });
  it("matches an empty string when contained", () => {
    assert.equal(matchCondition({ field: "a", op: "in", value: [""] }, { a: "" }), true);
  });
  it("rejects strict type mismatches", () => {
    assert.equal(
      matchCondition({ field: "a", op: "in", value: [10] }, { a: "10" }),
      false,
    );
  });
  it("rejects number versus boolean", () => {
    assert.equal(matchCondition({ field: "a", op: "in", value: [1] }, { a: true }), false);
  });
});

describe("matchCondition not_in", () => {
  it("matches a present uncontained value", () => {
    assert.equal(
      matchCondition({ field: "a", op: "not_in", value: ["x"] }, { a: "z" }),
      true,
    );
  });
  it("rejects a present contained value", () => {
    assert.equal(
      matchCondition({ field: "a", op: "not_in", value: ["x"] }, { a: "x" }),
      false,
    );
  });
  it("rejects an absent field", () => {
    assert.equal(matchCondition({ field: "a", op: "not_in", value: ["x"] }, {}), false);
  });
  it("matches null when the array omits null", () => {
    assert.equal(
      matchCondition({ field: "a", op: "not_in", value: ["x"] }, { a: null }),
      true,
    );
  });
  it("matches an empty string when uncontained", () => {
    assert.equal(
      matchCondition({ field: "a", op: "not_in", value: ["x"] }, { a: "" }),
      true,
    );
  });
});

describe("matchCondition is_set", () => {
  it("matches a present non-empty value", () => {
    assert.equal(matchCondition({ field: "a", op: "is_set" }, { a: "x" }), true);
  });
  it("rejects an absent field", () => {
    assert.equal(matchCondition({ field: "a", op: "is_set" }, {}), false);
  });
  it("rejects null", () => {
    assert.equal(matchCondition({ field: "a", op: "is_set" }, { a: null }), false);
  });
  it("rejects an empty string", () => {
    assert.equal(matchCondition({ field: "a", op: "is_set" }, { a: "" }), false);
  });
  it("rejects an empty array", () => {
    assert.equal(matchCondition({ field: "a", op: "is_set" }, { a: [] }), false);
  });
  it("matches a non-empty array", () => {
    assert.equal(matchCondition({ field: "a", op: "is_set" }, { a: [0] }), true);
  });
  it("matches zero and false as set values", () => {
    assert.equal(matchCondition({ field: "a", op: "is_set" }, { a: 0 }), true);
    assert.equal(matchCondition({ field: "a", op: "is_set" }, { a: false }), true);
  });
});

describe("matchCondition is_empty", () => {
  it("matches an absent field", () => {
    assert.equal(matchCondition({ field: "a", op: "is_empty" }, {}), true);
  });
  it("matches null", () => {
    assert.equal(matchCondition({ field: "a", op: "is_empty" }, { a: null }), true);
  });
  it("matches an empty string", () => {
    assert.equal(matchCondition({ field: "a", op: "is_empty" }, { a: "" }), true);
  });
  it("matches an empty array", () => {
    assert.equal(matchCondition({ field: "a", op: "is_empty" }, { a: [] }), true);
  });
  it("matches a plain object with zero keys", () => {
    assert.equal(matchCondition({ field: "a", op: "is_empty" }, { a: {} }), true);
  });
  it("rejects a present non-empty value", () => {
    assert.equal(matchCondition({ field: "a", op: "is_empty" }, { a: "x" }), false);
  });
  it("rejects zero and false as empty values", () => {
    assert.equal(matchCondition({ field: "a", op: "is_empty" }, { a: 0 }), false);
    assert.equal(matchCondition({ field: "a", op: "is_empty" }, { a: false }), false);
  });
  it("rejects a non-empty array and a keyed object", () => {
    assert.equal(matchCondition({ field: "a", op: "is_empty" }, { a: [0] }), false);
    assert.equal(matchCondition({ field: "a", op: "is_empty" }, { a: { k: 1 } }), false);
  });
});

describe("sortEnabledBindings", () => {
  it("keeps only enabled bindings", () => {
    const result = sortEnabledBindings([
      binding({ id: 1, is_enabled: true }),
      binding({ id: 2, is_enabled: false }),
      binding({ id: 3, is_enabled: null }),
      binding({ id: 4, is_enabled: 0 }),
    ]);
    assert.deepEqual(result.map((entry) => entry.id), [1]);
  });
  it("sorts numeric priorities ascending", () => {
    const result = sortEnabledBindings([
      binding({ id: 1, priority: 20 }),
      binding({ id: 2, priority: 5 }),
      binding({ id: 3, priority: 10 }),
    ]);
    assert.deepEqual(result.map((entry) => entry.id), [2, 3, 1]);
  });
  it("sorts null priorities after every numeric priority", () => {
    const result = sortEnabledBindings([
      binding({ id: 1, priority: null }),
      binding({ id: 2, priority: 5 }),
      binding({ id: 3 }),
    ]);
    assert.deepEqual(result.map((entry) => entry.id), [2, 1, 3]);
  });
  it("sorts string and float priorities after numeric priorities", () => {
    const result = sortEnabledBindings([
      binding({ id: 1, priority: "1" }),
      binding({ id: 2, priority: 1.5 }),
      binding({ id: 3, priority: 2 }),
    ]);
    assert.deepEqual(result.map((entry) => entry.id), [3, 1, 2]);
  });
  it("breaks numeric ties by id", () => {
    const result = sortEnabledBindings([
      binding({ id: 9, priority: 1 }),
      binding({ id: 3, priority: 1 }),
    ]);
    assert.deepEqual(result.map((entry) => entry.id), [3, 9]);
  });
  it("breaks string id ties by string order", () => {
    const result = sortEnabledBindings([
      binding({ id: "b", priority: 1 }),
      binding({ id: "a", priority: 1 }),
    ]);
    assert.deepEqual(result.map((entry) => entry.id), ["a", "b"]);
  });
  it("reproduces plain id-ascending order when all priorities are null", () => {
    const result = sortEnabledBindings([
      binding({ id: 30 }),
      binding({ id: 10 }),
      binding({ id: 20 }),
    ]);
    assert.deepEqual(result.map((entry) => entry.id), [10, 20, 30]);
  });
  it("never mutates the input array", () => {
    const input = [binding({ id: 2, priority: 2 }), binding({ id: 1, priority: 1 })];
    const snapshot = [...input];
    sortEnabledBindings(input);
    assert.deepEqual(input, snapshot);
  });
});

describe("evaluateRouting", () => {
  it("returns the first matching binding", () => {
    const first = binding({
      id: 1,
      conditions: [{ field: "a", op: "equals", value: "x" }],
      priority: 1,
    });
    const second = binding({
      id: 2,
      conditions: [{ field: "a", op: "equals", value: "x" }],
      priority: 2,
    });
    const result = evaluateRouting([first, second], { a: "x" });
    assert.equal(result.binding?.id, 1);
    assert.equal(result.reason, "matched");
  });
  it("matches a catch-all binding with empty conditions", () => {
    const result = evaluateRouting([binding({ id: 7, conditions: [] })], { a: "x" });
    assert.equal(result.binding?.id, 7);
    assert.equal(result.reason, "matched");
  });
  it("matches a catch-all binding with null conditions", () => {
    const result = evaluateRouting([binding({ id: 7, conditions: null })], { a: "x" });
    assert.equal(result.binding?.id, 7);
    assert.equal(result.reason, "matched");
  });
  it("skips bindings whose conditions are malformed", () => {
    const broken = binding({ id: 1, conditions: "hello", priority: 1 });
    const fallback = binding({ id: 2, conditions: [], priority: 2 });
    const result = evaluateRouting([broken, fallback], { a: "x" });
    assert.equal(result.binding?.id, 2);
    assert.equal(result.reason, "matched");
  });
  it("skips disabled bindings even when they would match", () => {
    const disabled = binding({
      id: 1,
      is_enabled: false,
      conditions: [],
      priority: 1,
    });
    const fallback = binding({ id: 2, conditions: [], priority: 2 });
    const result = evaluateRouting([disabled, fallback], {});
    assert.equal(result.binding?.id, 2);
  });
  it("requires every condition to match", () => {
    const candidate = binding({
      id: 1,
      conditions: [
        { field: "a", op: "equals", value: "x" },
        { field: "b", op: "is_set" },
      ],
    });
    assert.equal(evaluateRouting([candidate], { a: "x" }).binding, null);
    const matched = evaluateRouting([candidate], { a: "x", b: "y" });
    assert.equal(matched.binding?.id, 1);
    assert.equal(matched.reason, "matched");
  });
  it("returns no-match when nothing matches", () => {
    const candidate = binding({
      id: 1,
      conditions: [{ field: "a", op: "equals", value: "x" }],
    });
    const result = evaluateRouting([candidate], { a: "other" });
    assert.equal(result.binding, null);
    assert.equal(result.reason, "no-match");
  });
  it("returns no-match for an empty binding list", () => {
    const result = evaluateRouting([], { a: "x" });
    assert.equal(result.binding, null);
    assert.equal(result.reason, "no-match");
  });
  it("prefers priority order over input order", () => {
    const low = binding({
      id: 1,
      conditions: [{ field: "a", op: "equals", value: "x" }],
      priority: 10,
    });
    const high = binding({
      id: 2,
      conditions: [{ field: "a", op: "equals", value: "x" }],
      priority: 1,
    });
    const result = evaluateRouting([low, high], { a: "x" });
    assert.equal(result.binding?.id, 2);
  });
});

describe("extractConditionFields", () => {
  it("reads names and types from schema properties", () => {
    assert.deepEqual(
      extractConditionFields({
        properties: {
          status: { type: "string" },
          score: { type: "number" },
        },
      }),
      [
        { name: "status", type: "string" },
        { name: "score", type: "number" },
      ],
    );
  });
  it("defaults to string when a type is absent or not a string", () => {
    assert.deepEqual(
      extractConditionFields({ properties: { a: {}, b: { type: 42 } } }),
      [
        { name: "a", type: "string" },
        { name: "b", type: "string" },
      ],
    );
  });
  it("returns an empty array for schemas without properties", () => {
    assert.deepEqual(extractConditionFields(null), []);
    assert.deepEqual(extractConditionFields({}), []);
    assert.deepEqual(extractConditionFields({ properties: null }), []);
  });
});

describe("validateConditionsForSchema", () => {
  const schema = {
    properties: {
      status: { type: "string" },
      score: { type: "number" },
      tags: { type: "array" },
      nickname: { type: "string" },
    },
  };
  it("accepts well-formed conditions", () => {
    const result = validateConditionsForSchema(schema, [
      { field: "status", op: "equals", value: "active" },
      { field: "nickname", op: "is_set" },
    ]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, {});
  });
  it("reports an unknown field", () => {
    const result = validateConditionsForSchema(schema, [
      { field: "missing", op: "equals", value: "x" },
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.errors["0.missing"].length, 1);
  });
  it("reports a type mismatch", () => {
    const result = validateConditionsForSchema(schema, [
      { field: "score", op: "equals", value: "high" },
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.errors["0.score"].length, 1);
  });
  it("reports a value passed to is_set", () => {
    const result = validateConditionsForSchema(schema, [
      { field: "nickname", op: "is_set", value: "x" },
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.errors["0.nickname"].length > 0, true);
  });
  it("reports a value passed to is_empty", () => {
    const result = validateConditionsForSchema(schema, [
      { field: "nickname", op: "is_empty", value: "" },
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.errors["0.nickname"].length > 0, true);
  });
  it("reports a scalar passed to in", () => {
    const result = validateConditionsForSchema(schema, [
      { field: "status", op: "in", value: "active" },
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.errors["0.status"].length > 0, true);
  });
  it("reports an empty array passed to in", () => {
    const result = validateConditionsForSchema(schema, [
      { field: "status", op: "in", value: [] },
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.errors["0.status"].length > 0, true);
  });
  it("reports members that mismatch the declared type", () => {
    const result = validateConditionsForSchema(schema, [
      { field: "score", op: "in", value: [1, "two"] },
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.errors["0.score"].length > 0, true);
  });
  it("reports an unknown operator", () => {
    const result = validateConditionsForSchema(schema, [
      { field: "status", op: "gt", value: "x" },
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.errors["0.status"].length > 0, true);
  });
  it("collects errors across conditions without stopping at the first", () => {
    const result = validateConditionsForSchema(schema, [
      { field: "nope", op: "equals", value: "x" },
      { field: "score", op: "equals", value: "high" },
    ]);
    assert.equal(result.ok, false);
    assert.equal("0.nope" in result.errors, true);
    assert.equal("1.score" in result.errors, true);
  });
  it("accepts an empty condition list", () => {
    const result = validateConditionsForSchema(schema, []);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, {});
  });
});
