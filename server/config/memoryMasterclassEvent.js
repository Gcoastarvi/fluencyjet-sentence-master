// Weekly operator settings: change these three values, then redeploy/restart.
// Payment amount, product identity, and authorization are intentionally elsewhere.
export const MEMORY_MASTERCLASS_WEEKLY_SETTINGS = Object.freeze({
  startsAt: "2026-10-18T17:00:00+05:30",
  endsAt: "2026-10-18T19:00:00+05:30",
  whatsappGroupUrl: "https://chat.whatsapp.com/IUwQal62p4kDvJxIS9892s",
});

export function buildMemoryMasterclassEvent(settings) {
  const startsAt = new Date(settings.startsAt);
  const endsAt = new Date(settings.endsAt);
  if (!Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
    throw new Error("Memory Masterclass needs a valid start and later end time.");
  }
  const groupUrl = new URL(settings.whatsappGroupUrl);
  if (groupUrl.protocol !== "https:" || groupUrl.hostname !== "chat.whatsapp.com" ||
      groupUrl.port || groupUrl.username || groupUrl.password ||
      !/^\/[A-Za-z0-9]+$/.test(groupUrl.pathname) || groupUrl.search || groupUrl.hash) {
    throw new Error("Memory Masterclass needs a valid WhatsApp group invite URL.");
  }

  const timezone = "Asia/Kolkata";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(startsAt).map(part => [part.type, part.value]));
  const dateISO = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, weekday: "long",
  }).format(startsAt);
  const month = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, month: "long",
  }).format(startsAt);
  const timeFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true,
  });

  return Object.freeze({
    key: `${dateISO}_${parts.hour}${parts.minute}_ist`,
    startsAt,
    endsAt,
    timezone,
    dateISO,
    dateLabel: `${weekday}, ${Number(parts.day)} ${month}`,
    startTime: timeFormat.format(startsAt),
    endTime: timeFormat.format(endsAt),
    timezoneLabel: "IST",
    whatsappGroupUrl: groupUrl.href,
  });
}

export const MEMORY_MASTERCLASS_EVENT =
  buildMemoryMasterclassEvent(MEMORY_MASTERCLASS_WEEKLY_SETTINGS);

// Explicit allowlist: no checkout credentials, amounts, or learner information.
export function getPublicMemoryMasterclassEvent() {
  const event = MEMORY_MASTERCLASS_EVENT;
  return {
    key: event.key,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    timezone: event.timezone,
    dateISO: event.dateISO,
    dateLabel: event.dateLabel,
    startTime: event.startTime,
    endTime: event.endTime,
    timezoneLabel: event.timezoneLabel,
    whatsappGroupUrl: event.whatsappGroupUrl,
  };
}
