import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_ACCEPT, ATTACHMENT_HELP_TEXT, attachmentFileError, resumeError } from "./attachmentRules.ts";

const MB = 1024 * 1024;

test("the limits match what the upload route enforces", () => {
    assert.equal(ATTACHMENT_MAX_BYTES, 5 * MB);
    for (const t of ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]) {
        assert.ok(ATTACHMENT_ACCEPT.includes(t), t);
    }
    assert.match(ATTACHMENT_HELP_TEXT, /PDF/);
    assert.match(ATTACHMENT_HELP_TEXT, /5 MB/);
});

test("attachmentFileError: allowed types up to the limit pass", () => {
    assert.equal(attachmentFileError({ name: "cv.pdf", type: "application/pdf", size: 1 * MB }), null);
    assert.equal(attachmentFileError({ name: "id.png", type: "image/png", size: 5 * MB }), null);
});

test("attachmentFileError: wrong type or too large blocks, naming the file", () => {
    const docx = attachmentFileError({
        name: "cv.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 1 * MB,
    });
    assert.ok(docx);
    assert.match(docx, /cv\.docx/);
    assert.match(docx, /PDF/);

    const big = attachmentFileError({ name: "scan.pdf", type: "application/pdf", size: 5 * MB + 1 });
    assert.ok(big);
    assert.match(big, /scan\.pdf/);
    assert.match(big, /5 MB/);
});

test("resumeError: needs at least one Resume row that has a file", () => {
    assert.equal(resumeError([{ type: "Resume", file: { name: "cv.pdf" } }]), null);
    assert.equal(resumeError([{ type: "Other", file: { name: "x.pdf" } }, { type: "Resume", file: { name: "cv.pdf" } }]), null);
    assert.ok(resumeError([]));
    assert.ok(resumeError([{ type: "Resume", file: null }]));
    assert.ok(resumeError([{ type: "Other", file: { name: "x.pdf" } }]));
});
