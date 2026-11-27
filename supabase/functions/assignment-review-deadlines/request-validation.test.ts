import {
  constantTimeEqual,
  MAX_REQUEST_BODY_BYTES,
  readBoundedBody,
} from "./request-validation.ts";

Deno.test("dispatch secret comparison accepts only exact matches", () => {
  if (!constantTimeEqual("secret-value", "secret-value")) {
    throw new Error("identical secrets must match");
  }
  if (constantTimeEqual("secret-value", "secret-valuf")) {
    throw new Error("different secrets must not match");
  }
  if (constantTimeEqual("short", "longer")) {
    throw new Error("different-length secrets must not match");
  }
  if (constantTimeEqual("secret-value", "secret-value-extra")) {
    throw new Error("matching prefixes with different lengths must not match");
  }
  if (constantTimeEqual("secret-value-extra", "secret-value")) {
    throw new Error("matching suffixes with different lengths must not match");
  }
});

Deno.test("bounded body accepts valid UTF-8 within the limit", async () => {
  const expected = JSON.stringify({ limit: 50, note: "اختبار" });
  const result = await readBoundedBody(new Request("https://example.test", {
    method: "POST",
    body: expected,
  }));
  if (result.tooLarge || result.invalidUtf8 || result.text !== expected) {
    throw new Error("valid bounded UTF-8 body was not preserved");
  }
});

Deno.test("bounded body rejects a declared oversized body before reading", async () => {
  const result = await readBoundedBody(new Request("https://example.test", {
    method: "POST",
    headers: { "content-length": String(MAX_REQUEST_BODY_BYTES + 1) },
    body: "{}",
  }));
  if (!result.tooLarge || result.text !== "") {
    throw new Error("oversized declared body was not rejected");
  }
});

Deno.test("bounded body rejects chunked bodies that exceed the limit", async () => {
  const oversized = new Uint8Array(MAX_REQUEST_BODY_BYTES + 1);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(oversized);
      controller.close();
    },
  });
  const result = await readBoundedBody(new Request("https://example.test", {
    method: "POST",
    body: stream,
  }));
  if (!result.tooLarge || result.text !== "") {
    throw new Error("streamed oversized body was not rejected");
  }
});

Deno.test("bounded body rejects invalid UTF-8", async () => {
  const invalid = new Uint8Array([0xc3, 0x28]);
  const result = await readBoundedBody(new Request("https://example.test", {
    method: "POST",
    body: invalid,
  }));
  if (!result.invalidUtf8 || result.tooLarge) {
    throw new Error("invalid UTF-8 was not identified");
  }
});
