import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");
const M = "src/modules/human-resource-management";
const A = "src/app/api/hrm";
const CANONICAL_AUDIT = `${M}/shared/utils/audit.ts`;
const IN_SCOPE = [
    `${M}/onboarding`, `${M}/recruitment`, `${M}/employee-portal`, `${M}/application-form`,
    `${M}/manpower-request`, `${M}/quiz-file-management`, `${M}/interview-criteria`,
    `${M}/employee-admin/manpower-approval`, `${M}/shared`,
    `${A}/onboarding`, `${A}/interviews`, `${A}/interview-criteria`, `${A}/mailing`,
    `${A}/manpower-request`, `${A}/manpower-recommendation`, `${A}/manpower-approval`,
    `${A}/quiz-file-management`, `${A}/application-form`, `${A}/applications`,
];

const LEGACY_ALLOWLIST = {
    [`${M}/onboarding/hire/server/hiring-documents-filing-service.ts`]:
        "writes employee_file_record_list / employee_file_record_type, which the deployed File Management module also uses",
};

function sourceFiles(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) sourceFiles(full, out);
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");
const files = IN_SCOPE.flatMap((d) => sourceFiles(path.join(ROOT, d))).map((f) => ({ file: rel(f), text: fs.readFileSync(f, "utf8") }));

describe("recruitment/onboarding timestamps are UTC", () => {
    test("the scan covers the module", () => {
        assert.ok(files.length > 150, `only scanned ${files.length} files`);
    });

    test("no private Philippine-time producers", () => {
        const offenders = files
            .filter(({ file }) => file !== CANONICAL_AUDIT)
            .filter(({ text }) => /toLocaleString\(\s*["']sv-SE["']|DateTimeFormat\(\s*["']sv-SE["']/.test(text))
            .map((f) => f.file);
        assert.deepEqual(offenders, []);
    });

    test("nowPH() is only called by the documented legacy exceptions", () => {
        const offenders = files
            .filter(({ file, text }) => file !== CANONICAL_AUDIT && /\bnowPH\s*\(/.test(text) && !(file in LEGACY_ALLOWLIST))
            .map((f) => f.file);
        assert.deepEqual(offenders, []);
    });

    test("every legacy exception still needs its exception", () => {
        const stale = Object.keys(LEGACY_ALLOWLIST).filter((file) => !files.some((f) => f.file === file && /\bnowPH\s*\(/.test(f.text)));
        assert.deepEqual(stale, []);
    });
});
