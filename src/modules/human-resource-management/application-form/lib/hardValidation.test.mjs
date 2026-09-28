import { test } from "node:test";
import assert from "node:assert/strict";
import { maskGovId, maskPhone, phoneError, govIdError, maskDecimal, contactError, contactNumberError } from "./hardValidation.ts";

test("maskPhone keeps digits only, and a single leading +", () => {
    assert.equal(maskPhone("abc0917x123"), "0917123");
    assert.equal(maskPhone("09171234567"), "09171234567");
    assert.equal(maskPhone("+63 917 123 4567"), "+639171234567");
    assert.equal(maskPhone("0917+1234"), "09171234");
    assert.equal(maskPhone("++63"), "+63");
});

test("maskPhone caps length: 11 digits for 09..., 13 chars for +63...", () => {
    assert.equal(maskPhone("091712345678999"), "09171234567");
    assert.equal(maskPhone("+6391712345678999"), "+639171234567");
});

test("phoneError: empty is not this rule's job, valid formats pass", () => {
    assert.equal(phoneError(""), null);
    assert.equal(phoneError("09171234567"), null);
    assert.equal(phoneError("+639171234567"), null);
});

test("phoneError: anything else blocks, with the required format in the message", () => {
    for (const bad of ["0917123", "9171234567", "+63917123456", "08171234567", "abcdefghijk"]) {
        const msg = phoneError(bad);
        assert.ok(msg, `expected an error for ${bad}`);
        assert.match(msg, /09/);
        assert.match(msg, /\+639/);
    }
});

test("maskGovId inserts dashes as digits are typed and drops non-digits", () => {
    assert.equal(maskGovId("sss", "3412345678"), "34-1234567-8");
    assert.equal(maskGovId("sss", "34-12x34567-8"), "34-1234567-8");
    assert.equal(maskGovId("sss", "34123"), "34-123");
    assert.equal(maskGovId("tin", "123456789000"), "123-456-789-000");
    assert.equal(maskGovId("philhealth", "123456789012"), "12-345678901-2");
    assert.equal(maskGovId("pagibig", "123412341234"), "1234-1234-1234");
});

test("maskGovId ignores digits beyond the format's length", () => {
    assert.equal(maskGovId("sss", "341234567899999"), "34-1234567-8");
    assert.equal(maskGovId("pagibig", "12341234123499"), "1234-1234-1234");
});

test("maskGovId leaves an empty value empty and handles a trailing dash-boundary", () => {
    assert.equal(maskGovId("tin", ""), "");
    assert.equal(maskGovId("tin", "123"), "123");
    assert.equal(maskGovId("tin", "1234"), "123-4");
});

test("govIdError: empty passes (these are optional), complete values pass", () => {
    assert.equal(govIdError("sss", ""), null);
    assert.equal(govIdError("sss", "34-1234567-8"), null);
    assert.equal(govIdError("tin", "123-456-789-000"), null);
    assert.equal(govIdError("philhealth", "12-345678901-2"), null);
    assert.equal(govIdError("pagibig", "1234-1234-1234"), null);
});

test("govIdError: incomplete or malformed values block, naming the field and the format", () => {
    const sss = govIdError("sss", "34-123");
    assert.ok(sss);
    assert.match(sss, /SSS/);
    assert.match(sss, /##-#######-#/);
    assert.match(govIdError("tin", "123-456") ?? "", /TIN/);
    assert.match(govIdError("philhealth", "1") ?? "", /PhilHealth/);
    assert.match(govIdError("pagibig", "1234-12") ?? "", /Pag-IBIG/);
    assert.ok(govIdError("sss", "ab-cdefghi-j"));
});

test("maskDecimal keeps digits and at most one decimal point", () => {
    assert.equal(maskDecimal("abc"), "");
    assert.equal(maskDecimal("85.5"), "85.5");
    assert.equal(maskDecimal("8a5.5b"), "85.5");
    assert.equal(maskDecimal("1.2.3"), "1.23");
    assert.equal(maskDecimal("-5"), "5");
    assert.equal(maskDecimal(".5"), ".5");
    assert.equal(maskDecimal(""), "");
});

test("contactError: empty passes; an email or a phone number passes", () => {
    assert.equal(contactError(""), null);
    assert.equal(contactError("boss@company.com"), null);
    assert.equal(contactError("09171234567"), null);
    assert.equal(contactError("+63 917 123 4567"), null);
    assert.equal(contactError("(02) 8123-4567"), null);
    assert.equal(contactError("555-1234"), null);
});

test("contactError: gibberish and too-short numbers block, with guidance", () => {
    for (const bad of ["asdfgh", "12", "boss@", "boss@company", "12345678901234567890", "call me"]) {
        const msg = contactError(bad);
        assert.ok(msg, `expected an error for ${bad}`);
        assert.match(msg, /email/i);
        assert.match(msg, /phone/i);
    }
});

test("contactNumberError: empty passes; 7 to 13 digits with an optional leading + pass", () => {
    assert.equal(contactNumberError(""), null);
    assert.equal(contactNumberError("09171234567"), null);
    assert.equal(contactNumberError("+639171234567"), null);
    assert.equal(contactNumberError("0281234567"), null);
    assert.equal(contactNumberError("1234567"), null);
});

test("contactNumberError: too short, too long or lettered numbers block with guidance", () => {
    for (const bad of ["12345", "12345678901234", "abc1234567", "0917-123-4567"]) {
        const msg = contactNumberError(bad);
        assert.ok(msg, `expected an error for ${bad}`);
        assert.match(msg, /digits/i);
    }
});
