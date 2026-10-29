// Use only the server-owned event returned by the existing event endpoint.
// This does not calculate or approve another webinar date.
export function memoryBookingOpen(event, now = Date.now()) {
  const start = Date.parse(event?.startsAt), end = Date.parse(event?.endsAt);
  return Boolean(event?.key && event?.dateLabel && event?.startTime &&
    event?.endTime && event?.timezoneLabel && Number.isFinite(start) &&
    Number.isFinite(end) && end > start && start > Number(now));
}

export function memoryScheduleLabel(event) {
  return event?.dateLabel && event?.startTime && event?.endTime && event?.timezoneLabel
    ? `${event.dateLabel} · ${event.startTime}–${event.endTime} ${event.timezoneLabel}`
    : "Live class schedule awaiting confirmation";
}
