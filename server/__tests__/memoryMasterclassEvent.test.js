import { describe, expect, test } from "@jest/globals";
import {
  MEMORY_MASTERCLASS_EVENT,
  memoryMasterclassBookingOpen,
  MEMORY_MASTERCLASS_WEEKLY_SETTINGS,
  buildMemoryMasterclassEvent,
  getPublicMemoryMasterclassEvent,
} from "../config/memoryMasterclassEvent.js";

describe("server-owned weekly Memory Masterclass event", () => {
  test("derives the current IST schedule and public allowlisted fields", () => {
    const event = MEMORY_MASTERCLASS_EVENT;
    expect(event.startsAt.toISOString()).toBe(
      new Date(MEMORY_MASTERCLASS_WEEKLY_SETTINGS.startsAt).toISOString(),
    );
    expect(event.endsAt.toISOString()).toBe(
      new Date(MEMORY_MASTERCLASS_WEEKLY_SETTINGS.endsAt).toISOString(),
    );
    expect(event.whatsappGroupUrl).toBe(
      new URL(MEMORY_MASTERCLASS_WEEKLY_SETTINGS.whatsappGroupUrl).href,
    );
    expect(getPublicMemoryMasterclassEvent()).toEqual({
      key: event.key,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      timezone: "Asia/Kolkata",
      dateISO: event.dateISO,
      dateLabel: event.dateLabel,
      startTime: event.startTime,
      endTime: event.endTime,
      timezoneLabel: "IST",
      whatsappGroupUrl: event.whatsappGroupUrl,
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
    expect(next.dateISO).toBe("2026-10-25");
    expect(next.startsAt.toISOString()).toBe("2026-10-25T12:30:00.000Z");
    expect(next.endsAt.toISOString()).toBe("2026-10-25T14:30:00.000Z");
    expect(next.dateLabel).toBe("Sunday, 25 October 2026");
    expect(next.startTime).toBe("6:00 PM");
    expect(next.endTime).toBe("8:00 PM");
    expect(next.whatsappGroupUrl).toBe("https://chat.whatsapp.com/NextWeekInvite");
    expect(getPublicMemoryMasterclassEvent()).toEqual(original);
    expect(MEMORY_MASTERCLASS_EVENT.startsAt.toISOString()).toBe(original.startsAt);
  });

  test.each([
    { startsAt: "invalid" },
    { endsAt: MEMORY_MASTERCLASS_WEEKLY_SETTINGS.startsAt },
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



test("approved November 15 schedule, year and unchanged group destination", () => {
  const event = getPublicMemoryMasterclassEvent();
  expect(MEMORY_MASTERCLASS_WEEKLY_SETTINGS.startsAt).toBe("2026-11-15T17:00:00+05:30");
  expect(MEMORY_MASTERCLASS_WEEKLY_SETTINGS.endsAt).toBe("2026-11-15T19:00:00+05:30");
  expect(event.dateLabel).toBe("Sunday, 15 November 2026");
  expect(event.startTime).toBe("5:00 PM");
  expect(event.endTime).toBe("7:00 PM");
  expect(event.key).toBe("2026-11-15_1700_ist");
  expect(event.whatsappGroupUrl).toBe("https://chat.whatsapp.com/IUwQal62p4kDvJxIS9892s");
});


test("approved booking opens before 5 PM IST and closes exactly at the start", () => {
  expect(memoryMasterclassBookingOpen("2026-11-15T16:59:59+05:30")).toBe(true);
  expect(memoryMasterclassBookingOpen("2026-11-15T17:00:00+05:30")).toBe(false);
  expect(memoryMasterclassBookingOpen("2026-11-15T19:00:00+05:30")).toBe(false);
});
