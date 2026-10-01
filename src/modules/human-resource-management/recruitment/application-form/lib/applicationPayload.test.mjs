import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_APPLICATION_FORM } from "../types.ts";
import { buildSubmitPayload } from "./applicationPayload.ts";

const extras = { signatureFile: null, photoFile: null, uploadedAttachments: [] };
const form = (over = {}) => ({ ...structuredClone(DEFAULT_APPLICATION_FORM), ...over });
const member = (over = {}) => ({
    name: "", date_of_birth: "", is_deceased: false, occupation: "", company: "", education: "",
    contact_number: "", address: "", age: "", ...over,
});

test("a parent carries date of birth, contact number and address, and no stored age", () => {
    const f = form({ father: member({ name: "Juan", date_of_birth: "1960-05-01", contact_number: "09171234567", address: "Dagupan", occupation: "Farmer" }) });
    const row = buildSubmitPayload(f, extras).family_members.find((m) => m.relation === "Father");
    assert.deepEqual(row, {
        relation: "Father", name: "Juan", date_of_birth: "1960-05-01", is_deceased: false, age: null,
        occupation: "Farmer", company: null, education: null, contact_number: "09171234567", address: "Dagupan",
    });
});

test("a deceased parent is recorded as deceased and sends no occupation or company", () => {
    const f = form({ mother: member({ name: "Maria Santos", is_deceased: true, occupation: "Teacher", company: "DepEd" }) });
    const row = buildSubmitPayload(f, extras).family_members.find((m) => m.relation === "Mother");
    assert.equal(row.is_deceased, true);
    assert.equal(row.occupation, null);
    assert.equal(row.company, null);
    assert.equal(row.name, "Maria Santos");
});

test("a deceased flag alone still counts as information worth saving", () => {
    const f = form({ father: member({ is_deceased: true }) });
    assert.equal(buildSubmitPayload(f, extras).family_members.filter((m) => m.relation === "Father").length, 1);
});

test("a spouse who was filled in is kept whatever the civil status says", () => {
    const f = form({ civil_status: "Single", spouse: member({ name: "Ana" }) });
    assert.equal(buildSubmitPayload(f, extras).family_members.filter((m) => m.relation === "Spouse").length, 1);
});

test("an empty spouse block adds nothing", () => {
    assert.equal(buildSubmitPayload(form(), extras).family_members.length, 0);
});

test("a dependent carries its own date of birth, contact number and address", () => {
    const f = form({ family_dependents: [{ ...member({ name: "Pedro", date_of_birth: "2015-02-03", contact_number: "09170000000", address: "Home" }), relation: "Child" }] });
    const row = buildSubmitPayload(f, extras).family_members[0];
    assert.equal(row.relation, "Child");
    assert.equal(row.date_of_birth, "2015-02-03");
    assert.equal(row.contact_number, "09170000000");
    assert.equal(row.address, "Home");
    assert.equal(row.is_deceased, false);
});

const job = (over = {}) => ({
    employer: "Acme", address: "", job_title: "Clerk", date_from: "2020-01", date_to: "2022-06", currently_employed: false,
    salary_rate_start: "10000", salary_rate_end: "12000", supervisor_name: "", supervisor_contact: "",
    responsibilities: "", reason_for_leaving: "Better offer", ...over,
});

test("a past job keeps its end date, ending salary and reason for leaving", () => {
    const row = buildSubmitPayload(form({ work_experience: [job()] }), extras).work_experience[0];
    assert.equal(row.currently_employed, false);
    assert.equal(row.date_to, "2022-06");
    assert.equal(row.salary_rate_end, 12000);
    assert.equal(row.reason_for_leaving, "Better offer");
});

test("a current job sends no end date, ending salary or reason for leaving, even if they were typed before", () => {
    const row = buildSubmitPayload(form({ work_experience: [job({ currently_employed: true })] }), extras).work_experience[0];
    assert.equal(row.currently_employed, true);
    assert.equal(row.date_to, null);
    assert.equal(row.salary_rate_end, null);
    assert.equal(row.reason_for_leaving, null);
    assert.equal(row.date_from, "2020-01");
    assert.equal(row.salary_rate_start, 10000);
});
