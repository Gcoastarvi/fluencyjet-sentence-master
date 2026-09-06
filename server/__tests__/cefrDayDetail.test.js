import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockPrisma = {
  program: {
    findUnique: jest.fn(),
  },
  enrollment: {
    findFirst: jest.fn(),
  },
  learningDay: {
    findFirst: jest.fn(),
  },
};

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

const { getCefrDayDetail } = await import(
  "../services/cefrAccessService.js"
);

const NOW = new Date("2026-09-10T15:00:00.000Z");

const PROGRAM = {
  id: "program-1",
  slug: "german-a1",
  name: "German A1",
  cefrLevel: "A1",
  language: {
    code: "de",
    name: "German",
  },
};

function makeEnrollment({
  unlockAt = new Date("2026-09-10T14:00:00.000Z"),
  endDayNumber = 3,
} = {}) {
  return {
    id: "enrollment-1",
    status: "ACTIVE",
    enrolledAt: new Date("2026-09-01T10:00:00.000Z"),
    programVersionId: "version-1",
    programVersion: {
      id: "version-1",
      versionKey: "2026-v1",
      learningDays: [
        {
          id: "day-1",
          dayNumber: 1,
          title: "Hallo!",
          summary: "Greetings and introductions",
        },
      ],
    },
    entitlementGrants: [
      {
        id: "grant-1",
        startDayNumber: 1,
        endDayNumber,
        grantedAt: new Date("2026-09-01T10:00:00.000Z"),
      },
    ],
    cohortEnrollments: [
      {
        id: "membership-1",
        cohort: {
          id: "cohort-1",
          key: "german-a1-sep-a",
          name: "September A",
          timezone: "Asia/Kolkata",
          programVersionId: "version-1",
          liveSessions: [
            {
              id: "session-1",
              learningDayId: "day-1",
              startsAt: new Date("2026-09-10T13:00:00.000Z"),
              endsAt: new Date("2026-09-10T14:00:00.000Z"),
              appUnlockAt: unlockAt,
              status: "SCHEDULED",
            },
          ],
        },
      },
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.program.findUnique.mockResolvedValue(PROGRAM);
});

describe("getCefrDayDetail", () => {
  test("passes through PROGRAM_NOT_FOUND", async () => {
    mockPrisma.program.findUnique.mockResolvedValue(null);

    const result = await getCefrDayDetail({
      userId: 42,
      programSlug: "missing-program",
      dayNumber: 1,
      now: NOW,
    });

    expect(result.type).toBe("PROGRAM_NOT_FOUND");
    expect(mockPrisma.learningDay.findFirst).not.toHaveBeenCalled();
  });

  test("returns DAY_NOT_FOUND for a day outside the enrolled ProgramVersion", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue(makeEnrollment());

    const result = await getCefrDayDetail({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 2,
      now: NOW,
    });

    expect(result.type).toBe("DAY_NOT_FOUND");
    expect(mockPrisma.learningDay.findFirst).not.toHaveBeenCalled();
  });

  test("returns DAY_LOCKED before appUnlockAt without loading activity content", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue(
      makeEnrollment({
        unlockAt: new Date("2026-09-10T16:00:00.000Z"),
      }),
    );

    const result = await getCefrDayDetail({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      now: NOW,
    });

    expect(result.type).toBe("DAY_LOCKED");
    expect(result.day.accessState).toBe("SCHEDULED");
    expect(result.day.unlocked).toBe(false);
    expect(mockPrisma.learningDay.findFirst).not.toHaveBeenCalled();
  });

  test("loads ordered activity content for an unlocked day", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue(makeEnrollment());

    mockPrisma.learningDay.findFirst.mockResolvedValue({
      id: "day-1",
      dayNumber: 1,
      title: "Hallo!",
      summary: "Greetings and introductions",
      activities: [
        {
          id: "activity-1",
          key: "reorder-1",
          activityType: "REORDER",
          evaluationMode: "AUTO",
          title: "Build the sentence",
          orderIndex: 1,
          config: null,
          items: [
            {
              id: "item-1",
              itemKey: "q1",
              orderIndex: 1,
              prompt: { text: "Build the German sentence" },
              payload: { tokens: ["Ich", "heiße", "Anna"] },
              hint: null,
            },
          ],
        },
      ],
    });

    const result = await getCefrDayDetail({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      now: NOW,
    });

    expect(result.type).toBe("OK");
    expect(result.day).toMatchObject({
      id: "day-1",
      dayNumber: 1,
      entitled: true,
      unlocked: true,
      accessState: "UNLOCKED",
    });
    expect(result.day.activities).toHaveLength(1);

    expect(mockPrisma.learningDay.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "day-1",
          programVersionId: "version-1",
        },
      }),
    );

    const query = mockPrisma.learningDay.findFirst.mock.calls[0][0];

    expect(query.select.activities.select).not.toHaveProperty("xpConfig");
    expect(query.select.activities.select.items.select).not.toHaveProperty(
      "answerKey",
    );
    expect(query.select.activities.select.items.select).not.toHaveProperty(
      "feedback",
    );
  });

  test("returns DAY_NOT_FOUND if the unlocked day disappears before content load", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue(makeEnrollment());
    mockPrisma.learningDay.findFirst.mockResolvedValue(null);

    const result = await getCefrDayDetail({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      now: NOW,
    });

    expect(result.type).toBe("DAY_NOT_FOUND");
  });
});
