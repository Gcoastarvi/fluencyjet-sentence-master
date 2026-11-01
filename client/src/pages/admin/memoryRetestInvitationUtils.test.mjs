import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInvitationRequest,
  eventHasEnded,
  invitationErrorMessage,
} from "./memoryRetestInvitationUtils.mjs";

const purchaseId = "purchase-parent-123";

test("unassigned Parents purchase requires school level", () => {
  const purchase = {
    purchaseId,
    originalTrackId: "school_unspecified",
    assignedTrackId: null,
  };

  assert.equal(
    buildInvitationRequest(purchase, ""),
    null,
  );

  assert.deepEqual(
    buildInvitationRequest(
      purchase,
      "school_foundation",
    ),
    {
      purchaseId,
      schoolTrackId: "school_foundation",
    },
  );

  assert.deepEqual(
    buildInvitationRequest(
      purchase,
      "school_advanced",
    ),
    {
      purchaseId,
      schoolTrackId: "school_advanced",
    },
  );
});

test("existing assignment cannot be changed by browser", () => {
  const purchase = {
    purchaseId,
    originalTrackId: "school_unspecified",
    assignedTrackId: "school_foundation",
  };

  assert.deepEqual(
    buildInvitationRequest(
      purchase,
      "school_advanced",
    ),
    { purchaseId },
  );
});

test("invalid existing assignment fails closed", () => {
  const purchase = {
    purchaseId,
    originalTrackId: "school_unspecified",
    assignedTrackId: "advanced",
  };

  assert.equal(
    buildInvitationRequest(
      purchase,
      "school_foundation",
    ),
    null,
  );
});

test("existing specific tracks need no selection", () => {
  for (const originalTrackId of [
    "school_foundation",
    "school_advanced",
    "advanced",
  ]) {
    assert.deepEqual(
      buildInvitationRequest(
        { purchaseId, originalTrackId },
        "",
      ),
      { purchaseId },
    );
  }
});

test("unrecognized tracks fail closed", () => {
  assert.equal(
    buildInvitationRequest(
      {
        purchaseId,
        originalTrackId: "unknown",
      },
      "school_foundation",
    ),
    null,
  );
});

test("invalid purchase identifiers fail closed", () => {
  assert.equal(
    buildInvitationRequest(
      {
        purchaseId: "../invalid",
        originalTrackId: "advanced",
      },
      "",
    ),
    null,
  );
});

test("pre-event invitations remain blocked in interface", () => {
  const purchase = {
    eventEndsAt: "2026-11-15T13:30:00.000Z",
  };

  assert.equal(
    eventHasEnded(
      purchase,
      Date.parse("2026-11-15T13:29:59.000Z"),
    ),
    false,
  );

  assert.equal(
    eventHasEnded(
      purchase,
      Date.parse("2026-11-15T13:30:00.000Z"),
    ),
    true,
  );
});

test("invalid or missing event timestamps fail closed", () => {
  assert.equal(
    eventHasEnded({
      eventEndsAt: "not-a-date",
    }),
    false,
  );

  assert.equal(
    eventHasEnded({}),
    false,
  );
});

test("sensitive denial codes have useful messages", () => {
  for (const code of [
    "ADMIN_NOT_AUTHORIZED",
    "MASTERCLASS_NOT_FINISHED",
    "FORM_B_ALREADY_COMPLETED",
    "TRACK_SELECTION_MISMATCH",
  ]) {
    assert.ok(
      invitationErrorMessage(code).length > 15,
    );
  }
});
