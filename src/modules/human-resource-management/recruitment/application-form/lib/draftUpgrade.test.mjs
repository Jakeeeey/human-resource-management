import { test } from "node:test";
import assert from "node:assert/strict";
import { upgradeDraftValues } from "./draftUpgrade.ts";

const oldDraft = () => ({
    first_name: "Ana",
    father: { name: "Juan", age: "60", occupation: "Farmer", company: "", education: "" },
    mother: { name: "Maria", age: "", occupation: "", company: "", education: "" },
    spouse: { name: "", age: "", occupation: "", company: "", education: "" },
    family_dependents: [{ relation: "Child", name: "Pedro", age: "5", occupation: "", company: "", education: "" }],
    work_experience: [{ employer: "Acme", address: "", job_title: "", date_from: "Jan 2020", date_to: "", salary_rate_start: "", salary_rate_end: "", supervisor_name: "", supervisor_contact: "", responsibilities: "", reason_for_leaving: "" }],
});

test("family members gain the new fields and keep what was typed", () => {
    const up = upgradeDraftValues(oldDraft());
    assert.equal(up.father.name, "Juan");
    assert.equal(up.father.age, "60");
    assert.equal(up.father.date_of_birth, "");
    assert.equal(up.father.is_deceased, false);
    assert.equal(up.father.contact_number, "");
    assert.equal(up.father.address, "");
    assert.equal(up.family_dependents[0].name, "Pedro");
    assert.equal(up.family_dependents[0].date_of_birth, "");
});

test("work experience rows gain currently_employed as false and keep what was typed", () => {
    const up = upgradeDraftValues(oldDraft());
    assert.equal(up.work_experience[0].currently_employed, false);
    assert.equal(up.work_experience[0].employer, "Acme");
    assert.equal(up.work_experience[0].date_from, "Jan 2020");
});

test("a draft that already has the new fields is left as it is", () => {
    const d = oldDraft();
    d.father = { ...d.father, date_of_birth: "1960-05-01", is_deceased: true, contact_number: "0917", address: "x" };
    const up = upgradeDraftValues(d);
    assert.equal(up.father.date_of_birth, "1960-05-01");
    assert.equal(up.father.is_deceased, true);
});

test("a draft missing whole sections still upgrades", () => {
    const up = upgradeDraftValues({ first_name: "Ana" });
    assert.equal(up.first_name, "Ana");
    assert.equal(up.father.name, "");
    assert.deepEqual(up.family_dependents, []);
    assert.deepEqual(up.work_experience, []);
});
