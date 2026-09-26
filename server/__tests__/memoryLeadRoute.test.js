import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import request from "supertest";
import express from "express";

const mockPrisma = {
  memoryAssessmentSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

const { default: memoryRouter } = await import("../routes/memory.js");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/memory", memoryRouter);
  return app;
}

const VALID_LEAD = {
  ownerToken: "11111111-2222-4333-8444-555555555555",
  learnerName: "Arun",
  studentClass: "7",
  parentGuardianName: "Kumar",
  whatsappNumber: "98765 43210",
  whatsappConsent: true,
  email: "parent@example.com",
  state: "Tamil Nadu",
};

beforeEach(() => {
  jest.clearAllMocks();

  mockPrisma.memoryAssessmentSession.findUnique.mockResolvedValue({
    trackId: "school_foundation",
  });

  mockPrisma.memoryAssessmentSession.updateMany.mockResolvedValue({
    count: 1,
  });
});

describe("PATCH /api/memory/session/lead", () => {
  test("saves a Class 6–8 parent/guardian lead using only the private owner token", async () => {
    const res = await request(makeApp())
      .patch("/api/memory/session/lead")
      .send({
        ...VALID_LEAD,

        // A public token must not be used as the mutation credential.
        publicToken: "shareable-public-token",
      });

    expect(res.status).toBe(200);

    expect(res.body).toEqual({
      ok: true,
      lead: {
        saved: true,
      },
    });

    expect(
      mockPrisma.memoryAssessmentSession.updateMany,
    ).toHaveBeenCalledTimes(1);

    const call =
      mockPrisma.memoryAssessmentSession.updateMany.mock.calls[0][0];

    expect(call.where).toEqual({
      ownerToken: VALID_LEAD.ownerToken,
      trackId: "school_foundation",
    });

    expect(call.where.publicToken).toBeUndefined();

    expect(call.data).toMatchObject({
      learnerName: "Arun",
      studentClass: "7",
      parentGuardianName: "Kumar",

      whatsappNumber: "98765 43210",
      whatsappNumberNormalized: "+919876543210",
      whatsappContactRole: "PARENT_GUARDIAN",

      whatsappConsent: true,
      whatsappConsentSource:
        "memory-challenge-result-lead-form",

      email: "parent@example.com",
      state: "Tamil Nadu",

      status: "LEAD_CAPTURED",
    });

    expect(call.data.whatsappConsentAt).toBeInstanceOf(Date);
    expect(call.data.leadCapturedAt).toBeInstanceOf(Date);

    expect(call.data.whatsappConsentAt).toEqual(
      call.data.leadCapturedAt,
    );
  });

  test("saves a Class 9–12 lead using the track stored on the session", async () => {
    mockPrisma.memoryAssessmentSession.findUnique.mockResolvedValueOnce({
      trackId: "school_advanced",
    });

    const res = await request(makeApp())
      .patch("/api/memory/session/lead")
      .send({
        ...VALID_LEAD,
        studentClass: "11",
      });

    expect(res.status).toBe(200);

    expect(res.body).toEqual({
      ok: true,
      lead: {
        saved: true,
      },
    });

    expect(
      mockPrisma.memoryAssessmentSession.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        ownerToken: VALID_LEAD.ownerToken,
      },
      select: {
        trackId: true,
      },
    });

    const call =
      mockPrisma.memoryAssessmentSession.updateMany.mock.calls[0][0];

    expect(call.where).toEqual({
      ownerToken: VALID_LEAD.ownerToken,
      trackId: "school_advanced",
    });

    expect(call.data.studentClass).toBe("11");
  });

  test("rejects a Class 6–8 value for a Class 9–12 session", async () => {
    mockPrisma.memoryAssessmentSession.findUnique.mockResolvedValueOnce({
      trackId: "school_advanced",
    });

    const res = await request(makeApp())
      .patch("/api/memory/session/lead")
      .send({
        ...VALID_LEAD,
        studentClass: "7",
      });

    expect(res.status).toBe(400);

    expect(res.body).toEqual({
      ok: false,
      code: "INVALID_STUDENT_CLASS",
      message:
        "Class must be 9, 10, 11, or 12 for this assessment.",
    });

    expect(
      mockPrisma.memoryAssessmentSession.updateMany,
    ).not.toHaveBeenCalled();
  });

  test("allows email to be omitted", async () => {
    const payload = {
      ...VALID_LEAD,
    };

    delete payload.email;

    const res = await request(makeApp())
      .patch("/api/memory/session/lead")
      .send(payload);

    expect(res.status).toBe(200);

    const data =
      mockPrisma.memoryAssessmentSession.updateMany.mock.calls[0][0]
        .data;

    expect(data.email).toBeNull();
  });

  test("rejects an invalid WhatsApp number before Prisma is called", async () => {
    const res = await request(makeApp())
      .patch("/api/memory/session/lead")
      .send({
        ...VALID_LEAD,
        whatsappNumber: "12345",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_WHATSAPP_NUMBER");

    expect(
      mockPrisma.memoryAssessmentSession.updateMany,
    ).not.toHaveBeenCalled();
  });

  test("rejects classes outside the current Class 6–8 track", async () => {
    const res = await request(makeApp())
      .patch("/api/memory/session/lead")
      .send({
        ...VALID_LEAD,
        studentClass: "9",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_STUDENT_CLASS");

    expect(
      mockPrisma.memoryAssessmentSession.updateMany,
    ).not.toHaveBeenCalled();
  });

  test("requires explicit WhatsApp consent", async () => {
    const res = await request(makeApp())
      .patch("/api/memory/session/lead")
      .send({
        ...VALID_LEAD,
        whatsappConsent: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("WHATSAPP_CONSENT_REQUIRED");

    expect(
      mockPrisma.memoryAssessmentSession.updateMany,
    ).not.toHaveBeenCalled();
  });

  test("rejects a missing owner token", async () => {
    const payload = {
      ...VALID_LEAD,
    };

    delete payload.ownerToken;

    const res = await request(makeApp())
      .patch("/api/memory/session/lead")
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MEMORY_OWNER_TOKEN_REQUIRED");

    expect(
      mockPrisma.memoryAssessmentSession.updateMany,
    ).not.toHaveBeenCalled();
  });

  test("returns 404 when the private owner token does not match a session", async () => {
    mockPrisma.memoryAssessmentSession.updateMany.mockResolvedValueOnce({
      count: 0,
    });

    const res = await request(makeApp())
      .patch("/api/memory/session/lead")
      .send(VALID_LEAD);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      ok: false,
      code: "MEMORY_SESSION_NOT_FOUND",
      message: "Assessment session was not found.",
    });
  });

  test("rejects a malformed optional email", async () => {
    const res = await request(makeApp())
      .patch("/api/memory/session/lead")
      .send({
        ...VALID_LEAD,
        email: "not-an-email",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_EMAIL");

    expect(
      mockPrisma.memoryAssessmentSession.updateMany,
    ).not.toHaveBeenCalled();
  });

  test("returns a controlled 500 when lead persistence fails", async () => {
    mockPrisma.memoryAssessmentSession.updateMany.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    const res = await request(makeApp())
      .patch("/api/memory/session/lead")
      .send(VALID_LEAD);

    expect(res.status).toBe(500);

    expect(res.body).toEqual({
      ok: false,
      code: "MEMORY_LEAD_CAPTURE_FAILED",
      message: "Unable to save the assessment details right now.",
    });
  });
});
