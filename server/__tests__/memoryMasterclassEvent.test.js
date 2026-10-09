import { describe, expect, test } from "@jest/globals";
import {
  MEMORY_MASTERCLASS_EVENT,
  MEMORY_MASTERCLASS_WEEKLY_SETTINGS,
  buildMemoryMasterclassEvent,
  getPublicMemoryMasterclassEvent,
} from "../config/memoryMasterclassEvent.js";

describe("server-owned weekly Memory Masterclass event", () => {
  test("derives the current IST schedule and public allowlisted fields", () => {
    expect(getPublicMemoryMasterclassEvent()).toEqual({
      key: "2026-10-18_1700_ist",
      startsAt: "2026-10-18T11:30:00.000Z",
      endsAt: "2026-10-18T13:30:00.000Z",
      timezone: "Asia/Kolkata",
      dateISO: "2026-10-18",
      dateLabel: "Sunday, 18 October",
      startTime: "5:00 PM",
      endTime: "7:00 PM",
      timezoneLabel: "IST",
      whatsappGroupUrl: "https://chat.whatsapp.com/IUwQal62p4kDvJxIS9892s",
    });
  });

  test("a weekly change derives matching labels and key without mutating the old event", () => {
    const original = getPublicMemoryMasterclassEvent();
    const next = buildMemoryMasterclassEvent({
      startsAt: "2026-10-25T18:00:00+05:30",
      endsAt: "2026-10-25T20:00:00+05:30",
      whatsappGroupUrl: "https://chat.whatsapp.com/NextWeekInvite",
    });
    expect(next.key).toBe("2026-10-25_1800_ist");
    expect(next.dateLabel).toBe("Sunday, 25 October");
    expect(next.startTime).toBe("6:00 PM");
    expect(next.endTime).toBe("8:00 PM");
    expect(next.whatsappGroupUrl).toBe("https://chat.whatsapp.com/NextWeekInvite");
    expect(getPublicMemoryMasterclassEvent()).toEqual(original);
    expect(MEMORY_MASTERCLASS_EVENT.startsAt.toISOString()).toBe(original.startsAt);
  });

  test.each([
    { startsAt: "invalid" },
    { endsAt: "2026-10-18T16:00:00+05:30" },
    { whatsappGroupUrl: "http://chat.whatsapp.com/Invite" },
    { whatsappGroupUrl: "https://example.com/Invite" },
    { whatsappGroupUrl: "https://chat.whatsapp.com/" },
    { whatsappGroupUrl: "https://user:password@chat.whatsapp.com/Invite" },
    { whatsappGroupUrl: "https://chat.whatsapp.com/Invite?redirect=example" },
  ])("rejects invalid weekly settings: %j", invalid => {
    expect(() => buildMemoryMasterclassEvent({
      ...MEMORY_MASTERCLASS_WEEKLY_SETTINGS, ...invalid,
    })).toThrow();
  });
});
