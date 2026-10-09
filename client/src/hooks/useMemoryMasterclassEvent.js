import { useEffect, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export function useMemoryMasterclassEvent() {
  const [event, setEvent] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setEvent(null);
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/memory-masterclass/event`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok || !payload?.ok || !payload.event?.dateISO ||
            !payload.event?.dateLabel || !payload.event?.startTime ||
            !payload.event?.endTime || !payload.event?.timezoneLabel) {
          throw new Error("The class schedule could not be loaded.");
        }
        const groupUrl = new URL(payload.event.whatsappGroupUrl);
        if (groupUrl.protocol !== "https:" || groupUrl.hostname !== "chat.whatsapp.com" ||
            groupUrl.port || groupUrl.username || groupUrl.password ||
            !/^\/[A-Za-z0-9]+$/.test(groupUrl.pathname) || groupUrl.search || groupUrl.hash) {
          throw new Error("The class group link could not be loaded.");
        }
        if (!controller.signal.aborted) setEvent(payload.event);
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError("Class details could not be loaded. Please try again.");
        }
      }
    })();
    return () => controller.abort();
  }, [attempt]);

  return { event, error, retry: () => setAttempt(value => value + 1) };
}
