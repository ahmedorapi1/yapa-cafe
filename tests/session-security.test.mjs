import assert from "node:assert/strict";
import test from "node:test";

import { getCustomerVisibleStatus } from "../lib/orders/customer-status.ts";
import { parseMenuEntryUrl } from "../lib/orders/menu-url.ts";
import { resolveSessionAccess } from "../lib/orders/session-access.ts";

function actions(result) {
  const calls = [];
  return {
    calls,
    handlers: {
      async startSession(input) {
        calls.push({ type: "start", input });
        return result;
      },
      async restoreSession(input) {
        calls.push({ type: "restore", input });
        return result;
      },
    },
  };
}

test("valid physical QR token starts a session and produces a clean URL", async () => {
  const access = actions({ id: "new-session", active: true });
  const entry = parseMenuEntryUrl(
    "https://yapa-cafe-f3fb.vercel.app/menu/2?table_qr_token=secure-token-value",
  );
  const session = await resolveSessionAccess({
    tableNumber: "2",
    savedSessionId: null,
    tableQrToken: entry.tableQrToken,
    actions: access.handlers,
  });

  assert.equal(entry.cleanUrl, "/menu/2");
  assert.equal(entry.shouldCleanUrl, true);
  assert.equal(session.id, "new-session");
  assert.equal(access.calls.length, 1);
  assert.equal(access.calls[0].type, "start");
});

test("saved clean link on a new device never starts a session", async () => {
  const access = actions({ id: "must-not-exist" });
  const session = await resolveSessionAccess({
    tableNumber: "2",
    savedSessionId: null,
    tableQrToken: null,
    actions: access.handlers,
  });

  assert.equal(session, null);
  assert.deepEqual(access.calls, []);
});

test("clean link restores the existing session without minting another", async () => {
  const access = actions({ id: "existing-session", active: true });
  const session = await resolveSessionAccess({
    tableNumber: "2",
    savedSessionId: "existing-session",
    tableQrToken: null,
    actions: access.handlers,
  });

  assert.equal(session.id, "existing-session");
  assert.equal(access.calls.length, 1);
  assert.equal(access.calls[0].type, "restore");
});

test("expired saved session cannot invoke session creation without a QR token", async () => {
  const access = actions({ id: "expired-session", active: false });
  const session = await resolveSessionAccess({
    tableNumber: "2",
    savedSessionId: "expired-session",
    tableQrToken: null,
    actions: access.handlers,
  });

  assert.equal(session.active, false);
  assert.equal(access.calls.length, 1);
  assert.equal(access.calls[0].type, "restore");
  assert.equal(access.calls.some((call) => call.type === "start"), false);
});

test("scanning the physical QR after expiry starts a replacement session", async () => {
  const access = actions({ id: "replacement-session", active: true });
  const session = await resolveSessionAccess({
    tableNumber: "2",
    savedSessionId: "expired-session",
    tableQrToken: "fresh-physical-qr-token",
    actions: access.handlers,
  });

  assert.equal(session.id, "replacement-session");
  assert.equal(access.calls.length, 1);
  assert.equal(access.calls[0].type, "start");
  assert.equal(access.calls[0].input.existingSessionId, "expired-session");
});

test("legacy qr=1 is cleaned but never treated as a table token", async () => {
  const access = actions({ id: "must-not-exist" });
  const entry = parseMenuEntryUrl(
    "https://yapa-cafe-f3fb.vercel.app/menu/2?qr=1",
  );
  const session = await resolveSessionAccess({
    tableNumber: "2",
    savedSessionId: null,
    tableQrToken: entry.tableQrToken,
    actions: access.handlers,
  });

  assert.equal(entry.shouldCleanUrl, true);
  assert.equal(entry.cleanUrl, "/menu/2");
  assert.equal(session, null);
  assert.deepEqual(access.calls, []);
});

test("PAID is mapped to SERVED for every customer-facing status surface", () => {
  assert.equal(getCustomerVisibleStatus("PAID"), "SERVED");
  assert.equal(getCustomerVisibleStatus("SERVED"), "SERVED");
  assert.equal(getCustomerVisibleStatus("READY"), "READY");
});
