
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = new URL("../../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/%20/g, " ");
const ROOTS = [join(SRC, "app", "api", "hrm"), join(SRC, "modules", "human-resource-management")];

const TABLES = [
    "manpower_request",
    "manpower_recommendation",
    "applicant",
    "application",
    "quiz",
    "quiz_question",
    "quiz_question_choice",
    "quiz_question_expected_answer",
    "quiz_attempt",
    "quiz_attempt_answer",
    "interview",
    "interview_score_sheet",
    "interview_criteria_template",
];

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
}

function callRegion(text, at) {
    const open = text.lastIndexOf("(", at);
    if (open < 0) return "";
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        if (text[i] === "(") depth++;
        else if (text[i] === ")" && --depth === 0) return text.slice(open, i + 1);
    }
    return text.slice(open);
}

function writeSites() {
    const pattern = new RegExp("/items/(" + TABLES.join("|") + ")(?![a-z_])", "g");
    const sites = [];
    for (const file of ROOTS.flatMap((r) => walk(r))) {
        const text = readFileSync(file, "utf8");
        for (const m of text.matchAll(pattern)) {
            const region = callRegion(text, m.index);
            const method = /method:\s*"(POST|PATCH|PUT)"/.exec(region)?.[1];
            if (!method) continue;
            const varName = /body:\s*(?:JSON\.stringify\()?\s*([A-Za-z_]\w*)\s*\)?\s*[,}]/.exec(region)?.[1];
            let above = "";
            if (varName) {
                const before = text.slice(0, m.index);
                const declared = new RegExp(String.raw`(?:const|let|var)\s+` + varName + String.raw`\b`, "g");
                const decl = [...before.matchAll(declared)].pop()?.index ?? -1;
                above = decl >= 0 ? before.slice(decl) : before.slice(-800);
            }
            const line = text.slice(0, m.index).split("\n").length;
            sites.push({ file: relative(SRC, file), line, table: m[1], method, scope: region + above });
        }
    }
    return sites;
}

test("the scan actually finds the module's write sites", () => {
    assert.ok(writeSites().length >= 25);
});

test("every POST to a table with a DB timestamp default sends created_at itself", () => {
    const bad = writeSites()
        .filter((s) => s.method === "POST" && !/created_at|creationTimestamps/.test(s.scope))
        .map((s) => `${s.table}  ${s.file}:${s.line}`);
    assert.deepEqual(bad, []);
});

test("every PATCH/PUT to a table with a DB timestamp default sends updated_at itself", () => {
    const bad = writeSites()
        .filter((s) => s.method !== "POST" && !/updated_at|creationTimestamps/.test(s.scope))
        .map((s) => `${s.table}  ${s.file}:${s.line}`);
    assert.deepEqual(bad, []);
});
