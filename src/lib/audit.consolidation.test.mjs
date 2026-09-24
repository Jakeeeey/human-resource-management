import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..");
const CANONICAL = "src/lib/audit.ts";
const NAMES = ["actorIdFromJwt", "stampCreate", "stampUpdate", "nowPH"];
const RETIRED = [
    "src/modules/human-resource-management/manpower-request/utils/audit.ts",
    "src/modules/human-resource-management/recruitment/utils/audit.ts",
    "src/modules/human-resource-management/onboarding/utils/audit.ts",
];

function sourceFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) sourceFiles(full, out);
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
}

const rel = (file) => path.relative(path.resolve(SRC, ".."), file).split(path.sep).join("/");
const files = sourceFiles(SRC).map((file) => ({ file: rel(file), text: fs.readFileSync(file, "utf8") }));

describe("audit helpers are consolidated", () => {
    test("the scan actually covers the codebase", () => {
        assert.ok(files.length > 200, `only scanned ${files.length} files`);
    });

    test("the canonical module exists", () => {
        assert.ok(fs.existsSync(path.resolve(SRC, "..", CANONICAL)), `${CANONICAL} is missing`);
    });

    test("the three per-module copies are gone", () => {
        const remaining = RETIRED.filter((p) => fs.existsSync(path.resolve(SRC, "..", p)));
        assert.deepEqual(remaining, []);
    });

    test("each helper is defined exactly once, in the canonical module", () => {
        const definitions = [];
        for (const { file, text } of files) {
            for (const name of NAMES) {
                if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`).test(text)) definitions.push(`${name} in ${file}`);
            }
        }
        assert.deepEqual(definitions.sort(), NAMES.map((n) => `${n} in ${CANONICAL}`).sort());
    });

    test("every import of a helper comes from @/lib/audit", () => {
        const offenders = [];
        const importRe = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
        for (const { file, text } of files) {
            if (file === CANONICAL) continue;
            for (const match of text.matchAll(importRe)) {
                const imported = match[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, ""));
                if (imported.some((n) => NAMES.includes(n)) && match[2] !== "@/lib/audit") offenders.push(`${file} imports from "${match[2]}"`);
            }
        }
        assert.deepEqual(offenders, []);
    });
});
