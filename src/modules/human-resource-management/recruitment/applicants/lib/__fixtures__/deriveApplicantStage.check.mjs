// Throwaway fixture check for deriveApplicantStage (todo 1).
// Run: node <this-file>  (workdir: human-resource-management)
// Uses Node 24 native type-stripping to import the TS helper directly;
// no new dependencies. This file is NOT covered by tsc (untracked ext)
// but MUST stay eslint-clean.
const { deriveApplicantStage, APPLICANT_STAGE } = await import(
    "../deriveApplicantStage.ts"
);

const EXPECTED_ORDER = [
    "Initial Pending",
    "Initial Passed",
    "Initial Failed",
    "Recommended",
    "Final Pending",
    "Final Passed",
    "Final Failed",
    "Approved",
    "Hired",
    "Rejected",
    "Withdrawn",
];

const failures = [];
function check(name, actual, expected) {
    const ok = actual === expected;
    console.log(`${ok ? "PASS" : "FAIL"} ${name}: got "${actual}", want "${expected}"`);
    if (!ok) failures.push(name);
}

check(
    "APPLICANT_STAGE order",
    JSON.stringify(APPLICANT_STAGE),
    JSON.stringify(EXPECTED_ORDER),
);

const base = (over = {}) => ({
    application: { id: 1, submitted_at: "2026-01-01T08:00:00", quiz_passed: null },
    quizAttempt: null,
    initialInterviews: [],
    recommendations: [],
    finalInterviews: [],
    ...over,
});

const app = (id, submitted_at) => ({
    id,
    submitted_at,
    quiz_passed: null,
});
const iv = (id, verdict, created_at, recommendation_id = null) => ({
    id,
    recommendation_id,
    verdict,
    created_at,
});
const rec = (id, status, created_at) => ({ id, status, created_at });

const cases = [
    {
        name: "no-signal-awaiting-initial",
        input: base(),
        expect: "Initial Pending",
    },
    {
        name: "initial-pending",
        input: base({ initialInterviews: [iv(3, "Pending", "2026-01-03T08:00:00")] }),
        expect: "Initial Pending",
    },
    {
        name: "initial-passed",
        input: base({ initialInterviews: [iv(3, "Passed", "2026-01-03T08:00:00")] }),
        expect: "Initial Passed",
    },
    {
        name: "initial-failed",
        input: base({ initialInterviews: [iv(3, "Failed", "2026-01-03T08:00:00")] }),
        expect: "Initial Failed",
    },
    {
        name: "recommended",
        input: base({
            initialInterviews: [iv(3, "Passed", "2026-01-03T08:00:00")],
            recommendations: [rec(5, "Recommended", "2026-01-04T08:00:00")],
        }),
        expect: "Recommended",
    },
    {
        name: "final-pending-keeps-eligible",
        input: base({
            recommendations: [rec(5, "Recommended", "2026-01-04T08:00:00")],
            finalInterviews: [iv(9, "Pending", "2026-01-05T08:00:00", 5)],
        }),
        expect: "Final Pending",
    },
    {
        name: "final-passed",
        input: base({
            recommendations: [rec(5, "Recommended", "2026-01-04T08:00:00")],
            finalInterviews: [iv(9, "Passed", "2026-01-05T08:00:00", 5)],
        }),
        expect: "Final Passed",
    },
    {
        name: "final-failed",
        input: base({
            recommendations: [rec(5, "Recommended", "2026-01-04T08:00:00")],
            finalInterviews: [iv(9, "Failed", "2026-01-05T08:00:00", 5)],
        }),
        expect: "Final Failed",
    },
    {
        name: "approved",
        input: base({ recommendations: [rec(5, "Approved", "2026-01-06T08:00:00")] }),
        expect: "Approved",
    },
    {
        name: "hired",
        input: base({ recommendations: [rec(5, "Hired", "2026-01-07T08:00:00")] }),
        expect: "Hired",
    },
    {
        name: "rejected",
        input: base({ recommendations: [rec(5, "Rejected", "2026-01-06T08:00:00")] }),
        expect: "Rejected",
    },
    {
        name: "withdrawn",
        input: base({ recommendations: [rec(5, "Withdrawn", "2026-01-06T08:00:00")] }),
        expect: "Withdrawn",
    },
    {
        name: "conflict-failed-initial-then-recommended",
        input: base({
            initialInterviews: [iv(3, "Failed", "2026-01-03T08:00:00")],
            recommendations: [rec(5, "Recommended", "2026-01-04T08:00:00")],
        }),
        expect: "Recommended",
    },
    {
        name: "conflict-passed-final-then-rejected",
        input: base({
            recommendations: [rec(5, "Rejected", "2026-01-06T08:00:00")],
            finalInterviews: [iv(9, "Passed", "2026-01-05T08:00:00", 5)],
        }),
        expect: "Rejected",
    },
    {
        name: "tied-timestamps-id-desc",
        input: base({
            initialInterviews: [
                iv(3, "Passed", "2026-01-03T08:00:00"),
                iv(4, "Failed", "2026-01-03T08:00:00"),
            ],
        }),
        expect: "Initial Failed",
    },
    {
        name: "graded-final-beats-pending-final",
        input: base({
            recommendations: [rec(5, "Recommended", "2026-01-04T08:00:00")],
            finalInterviews: [
                iv(9, "Pending", "2026-01-05T08:00:00", 5),
                iv(10, "Passed", "2026-01-06T08:00:00", 5),
            ],
        }),
        expect: "Final Passed",
    },
    {
        name: "quiz-ignored-then-initial-passed",
        input: base({
            application: app(1, "2026-01-01T08:00:00"),
            quizAttempt: { id: 7, passed: false, created_at: "2026-01-02T08:00:00" },
            initialInterviews: [iv(3, "Passed", "2026-01-03T08:00:00")],
        }),
        expect: "Initial Passed",
    },
];

for (const { name, input, expect } of cases) {
    const { stage, timeline } = deriveApplicantStage(input);
    check(name, stage, expect);
    const ordered = timeline.every(
        (e, i, arr) => i === 0 || (arr[i - 1].at ?? "") <= (e.at ?? ""),
    );
    check(`${name} timeline oldest-first`, String(ordered), "true");
    if (timeline.length > 0) {
        check(
            `${name} timeline contains stage`,
            String(timeline.some((e) => e.stage === expect)),
            "true",
        );
    }
}

console.log(
    failures.length === 0
        ? `\nOK: all ${cases.length} fixture cases passed`
        : `\nFAILED: ${failures.length} check(s): ${failures.join(", ")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
