const SCHOOL_TRACKS = new Set([
  "school_foundation",
  "school_advanced",
]);

const ALL_TRACKS = new Set([
  ...SCHOOL_TRACKS,
  "advanced",
]);

export const TRACK_LABELS = Object.freeze({
  school_foundation: "Classes 6–8",
  school_advanced: "Classes 9–12",
  advanced: "Advanced learners",
  school_unspecified: "School level not yet assigned",
});

export function buildInvitationRequest(purchase, schoolTrackId) {
  const purchaseId = purchase?.purchaseId;

  if (
    typeof purchaseId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(purchaseId)
  ) {
    return null;
  }

  if (purchase.originalTrackId === "school_unspecified") {
    // A previous administrator assignment must remain locked.
    if (SCHOOL_TRACKS.has(purchase.assignedTrackId)) {
      return { purchaseId };
    }

    if (purchase.assignedTrackId != null) {
      return null;
    }

    if (!SCHOOL_TRACKS.has(schoolTrackId)) {
      return null;
    }

    return { purchaseId, schoolTrackId };
  }

  if (ALL_TRACKS.has(purchase.originalTrackId)) {
    return { purchaseId };
  }

  return null;
}

export function eventHasEnded(purchase, now = Date.now()) {
  const end = Date.parse(purchase?.eventEndsAt ?? "");

  return Number.isFinite(end) &&
    Number.isFinite(now) &&
    end <= now;
}

export function invitationErrorMessage(code) {
  const messages = {
    ADMIN_AUTH_REQUIRED:
      "Please log in to the administrator dashboard again.",
    ADMIN_AUTH_INVALID:
      "Your administrator session has expired. Please log in again.",
    ADMIN_NOT_AUTHORIZED:
      "Your account is not authorized for this operation.",
    ADMIN_INVITATION_AUTH_NOT_CONFIGURED:
      "The server's administrator authentication is not configured.",
    ADMIN_PURCHASE_SEARCH_RATE_LIMITED:
      "Too many searches. Please try again later.",
    ADMIN_INVITATION_RATE_LIMITED:
      "Too many invitation requests. Please try again later.",
    PURCHASE_SEARCH_INVALID:
      "Enter at least three characters to search.",
    PURCHASE_NOT_FOUND:
      "This purchase could not be found.",
    PURCHASE_NOT_CAPTURED:
      "This payment has not been captured.",
    SCHOOL_TRACK_REQUIRED:
      "Please choose the student's school level.",
    TRACK_SELECTION_MISMATCH:
      "This purchase already has a different assessment track.",
    TRACK_ASSIGNMENT_CONFLICT:
      "The school-track assignment has changed. Search again.",
    MASTERCLASS_NOT_FINISHED:
      "Invitations can be generated only after the purchased masterclass ends.",
    FORM_B_ALREADY_COMPLETED:
      "The student has already completed Form B.",
    ADMIN_PURCHASE_SEARCH_ORIGIN_DENIED:
      "This administrator website origin is not authorized.",
    ADMIN_INVITATION_ORIGIN_DENIED:
      "This administrator website origin is not authorized.",
  };

  return messages[code] ||
    "The request could not be completed. Please check the registration and try again.";
}
