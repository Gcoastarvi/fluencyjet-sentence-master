import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryBookingOpen, memoryScheduleLabel } from "./memorySchedule.js";
const event = { key: "mock-event", startsAt: "2030-01-02T11:30:00Z", endsAt: "2030-01-02T13:30:00Z",
  dateLabel: "Mock approved date", startTime: "5:00 PM", endTime: "7:00 PM", timezoneLabel: "IST" };
test("uses a valid server event without a hardcoded calendar date", () => {
  assert.equal(memoryBookingOpen(event, Date.parse("2030-01-01")), true);
  assert.equal(memoryScheduleLabel(event), "Mock approved date · 5:00 PM–7:00 PM IST");
});
test("started, expired, missing and invalid schedules cannot enable booking", () => {
  for (const candidate of [null, {}, { ...event, startsAt: "invalid" }, { ...event, endsAt: event.startsAt }])
    assert.equal(memoryBookingOpen(candidate, Date.parse("2030-01-01")), false);
  assert.equal(memoryBookingOpen(event, Date.parse(event.startsAt)), false);
  assert.equal(memoryBookingOpen(event, Date.parse("2030-01-03")), false);
});
