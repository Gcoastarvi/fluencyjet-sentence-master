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
});