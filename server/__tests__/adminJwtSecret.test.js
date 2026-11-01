import test from "node:test";
import assert from "node:assert/strict";
import { getAdminJwtSecret } from "../utils/adminJwtSecret.js";

test("rejects missing JWT_SECRET", () => {
  assert.equal(getAdminJwtSecret({}), null);
});

test("rejects empty JWT_SECRET", () => {
  assert.equal(getAdminJwtSecret({ JWT_SECRET: "" }), null);
});

test("rejects predictable legacy fallback", () => {
  assert.equal(
    getAdminJwtSecret({
      JWT_SECRET: "fluencyjet_secret_2025",
    }),
    null
  );
});

test("rejects secrets shorter than 32 characters", () => {
  assert.equal(
    getAdminJwtSecret({ JWT_SECRET: "a".repeat(31) }),
    null
  );
});

test("rejects whitespace-only secrets", () => {
  assert.equal(
    getAdminJwtSecret({ JWT_SECRET: " ".repeat(40) }),
    null
  );
});

test("accepts a configured 32-character secret", () => {
  const secret = "X".repeat(32);

  assert.equal(
    getAdminJwtSecret({ JWT_SECRET: secret }),
    secret
  );
});

test("preserves the configured secret exactly", () => {
  const secret = "secure-example-" + "Z".repeat(40);

  assert.equal(
    getAdminJwtSecret({ JWT_SECRET: secret }),
    secret
  );
});
