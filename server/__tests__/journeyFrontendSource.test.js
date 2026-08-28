import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceDirectory = path.resolve(serverDirectory, "..", "..");

function readClientSource(relativePath) {
  return fs.readFileSync(
    path.join(workspaceDirectory, "client", "src", "pages", "student", relativePath),
    "utf8",
  );
}

function readClientFile(relativePath) {
  return fs.readFileSync(
    path.join(workspaceDirectory, "client", "src", relativePath),
    "utf8",
  );
}

describe("Block A frontend milestone placement", () => {
  test("LessonList does not record learning-path exploration during mount", () => {
    const source = readClientSource("LessonList.jsx");

    expect(source).not.toContain(
      'milestoneType: "LEARNING_PATH_EXPLORED"',
    );
  });

  test("the explicit free-lessons CTA attempts learning-path recording", () => {
    const source = readClientSource("SentencePractice.jsx");

    expect(source).toContain("Continue to My 3 Free Lessons");
    expect(source).toContain(
      'api.api.post("/funnel/journey-milestone",',
    );
    expect(source).toContain(
      'milestoneType: "LEARNING_PATH_EXPLORED"',
    );
    expect(source).toContain('navigate("/b/lessons")');
  });

  test("Dashboard and Navbar record exploration before explicit Lessons navigation", () => {
    const dashboardSource = readClientSource("Dashboard.jsx");
    const navbarSource = readClientFile("components/Navbar.jsx");

    expect(dashboardSource).toContain(
      "await recordLearningPathExplored();",
    );
    expect(dashboardSource).toContain("onClick={handleLessonsNavigation}");
    expect(dashboardSource).toContain("handleMobileNavigation(item)");
    expect(navbarSource).toContain(
      "await recordLearningPathExplored();",
    );
    expect(navbarSource).toContain("onClick={handleLessonsClick}");
  });

  test("Lesson Detail records exploration before both lesson-list controls navigate", () => {
    const source = readClientSource("LessonDetail.jsx");

    expect(source).toContain(
      'import { recordLearningPathExplored } from "@/lib/journeyMilestones";',
    );
    expect(source).toContain(
      "async function navigateToLessonsWithMilestone(destination)",
    );
    expect(source).toContain(
      'onClick={() => navigateToLessonsWithMilestone("/lessons")}',
    );
    expect(source).toContain(
      'navigateToLessonsWithMilestone(\n                    "/b/lessons?onboarding=1&source=spoken-english-challenge&focus=lesson-1",',
    );
  });
});