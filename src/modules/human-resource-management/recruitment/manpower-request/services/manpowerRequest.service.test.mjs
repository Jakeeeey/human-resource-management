import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { manpowerRequestService } from "./manpowerRequest.service.ts";

afterEach(() => mock.restoreAll());

function captureFetch() {
    const calls = [];
    mock.method(globalThis, "fetch", async (url, init = {}) => {
        calls.push({ url: String(url), init });
        return { ok: true, status: 200, json: async () => ({ data: { id: 1 } }), text: async () => "" };
    });
    return calls;
}

test("creating a request stamps created_at with a UTC moment and leaves updated_at null", async () => {
    const calls = captureFetch();
    await manpowerRequestService.create({ request_no: "MR-2026-001", position: "Clerk" });
    const post = calls.find((c) => c.init.method === "POST");
    assert.ok(post, "expected a POST");
    const body = JSON.parse(post.init.body);
    assert.match(body.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.equal(body.updated_at, null);
});

test("updating a request stamps updated_at with a UTC moment", async () => {
    const calls = captureFetch();
    await manpowerRequestService.update(1, { position: "Clerk II" });
    const patch = calls.find((c) => c.init.method === "PATCH");
    assert.ok(patch, "expected a PATCH");
    assert.match(JSON.parse(patch.init.body).updated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});
