import { api } from "@/api/apiClient";

const MILESTONE_REQUEST_TIMEOUT_MS = 1500;

export async function recordLearningPathExplored() {
  let timeoutId;

  try {
    const milestoneRequest = api.post("/funnel/journey-milestone", {
      milestoneType: "LEARNING_PATH_EXPLORED",
    });

    const timeout = new Promise((resolve) => {
      timeoutId = setTimeout(
        () => resolve({ ok: false, timedOut: true }),
        MILESTONE_REQUEST_TIMEOUT_MS,
      );
    });

    const result = await Promise.race([milestoneRequest, timeout]);

    if (!result?.ok) {
      console.warn(
        result?.timedOut
          ? "[journey] Learning path milestone request timed out."
          : "[journey] Learning path milestone was not recorded.",
      );
    }
  } catch {
    console.warn("[journey] Learning path milestone request failed.");
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}