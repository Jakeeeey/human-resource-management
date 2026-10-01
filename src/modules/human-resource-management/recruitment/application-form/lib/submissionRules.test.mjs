import { test } from "node:test";
import assert from "node:assert/strict";
import { submissionError } from "./submissionRules.ts";

const valid = () => ({
    phone: "09171234567",
    sss_no: "34-1234567-8",
    tin: null,
    philhealth_no: null,
    pagibig_no: null,
    family_members: [{ relation: "Father", name: "Juan", contact_number: "09171234567" }],
    work_experience: [{ employer: "Acme", supervisor_contact: "boss@acme.com" }],
});

test("a complete, well-formed submission passes", () => {
    assert.equal(submissionError(valid()), null);
});

test("the applicant's contact number must be a valid mobile number", () => {
    assert.match(submissionError({ ...valid(), phone: "abcdef" }) ?? "", /contact number/i);
    assert.match(submissionError({ ...valid(), phone: "0917123" }) ?? "", /09/);
});

test("each government ID, when given, must match its format", () => {
    assert.match(submissionError({ ...valid(), sss_no: "12-34" }) ?? "", /SSS/);
    assert.match(submissionError({ ...valid(), tin: "123" }) ?? "", /TIN/);
    assert.match(submissionError({ ...valid(), philhealth_no: "x" }) ?? "", /PhilHealth/);
    assert.match(submissionError({ ...valid(), pagibig_no: "1" }) ?? "", /Pag-IBIG/);
    assert.equal(submissionError({ ...valid(), sss_no: null, tin: "123-456-789-000" }), null);
});

test("a family member's contact number must be a valid number, and the message names them", () => {
    const bad = { ...valid(), family_members: [{ relation: "Mother", name: "Maria", contact_number: "call me" }] };
    const msg = submissionError(bad) ?? "";
    assert.match(msg, /Mother/);
    assert.match(msg, /Maria/);
    assert.equal(submissionError({ ...valid(), family_members: [{ relation: "Mother", name: "Maria", contact_number: null }] }), null);
});

test("a supervisor contact must be an email or a phone number", () => {
    const bad = { ...valid(), work_experience: [{ employer: "Acme", supervisor_contact: "asdfgh" }] };
    assert.match(submissionError(bad) ?? "", /Acme/);
});
