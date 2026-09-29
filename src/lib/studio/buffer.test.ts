import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bufferGraphql,
  decryptBufferApiKey,
  encryptBufferApiKey,
} from "./buffer.server.ts";

test("Buffer credentials are encrypted and bound to their user id", () => {
  const previousSecret = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "test-only-auth-secret";
  try {
    const ciphertext = encryptBufferApiKey("user-a", "buffer-test-api-key");
    assert.notEqual(ciphertext, "buffer-test-api-key");
    assert.equal(decryptBufferApiKey("user-a", ciphertext), "buffer-test-api-key");
    assert.throws(() => decryptBufferApiKey("user-b", ciphertext));
  } finally {
    if (previousSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previousSecret;
  }
});

test("Buffer GraphQL requests use the server-side bearer key", async () => {
  const originalFetch = globalThis.fetch;
  let requestAuthorization = "";
  globalThis.fetch = async (input, init) => {
    assert.equal(input, "https://api.buffer.com");
    requestAuthorization = new Headers(init?.headers).get("authorization") ?? "";
    return Response.json({ data: { account: { id: "account-1" } } });
  };

  try {
    const result = await bufferGraphql<{ account: { id: string } }>(
      "server-only-test-key",
      "query { account { id } }",
    );
    assert.equal(requestAuthorization, "Bearer server-only-test-key");
    assert.equal(result.account.id, "account-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
