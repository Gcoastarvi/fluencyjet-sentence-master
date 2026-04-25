import React from "react";
import LegalLayout from "./LegalLayout";

export default function Disclaimer() {
  return (
    <LegalLayout title="Disclaimer" updated="April 25, 2026">
      <p>
        FluencyJet Sentence Master is an educational platform designed to help
        learners practice English sentence formation and spoken English skills.
      </p>

      <h2>1. Educational purpose</h2>
      <p>
        The content, lessons, quizzes, exercises, and practice activities are
        provided for educational and self-improvement purposes.
      </p>

      <h2>2. No guaranteed results</h2>
      <p>
        We do not guarantee that every learner will achieve fluency, pass an
        exam, get a job, or reach a specific communication level. Results depend
        on effort, consistency, practice, prior knowledge, and individual
        learning ability.
      </p>

      <h2>3. Not a formal certification</h2>
      <p>
        Unless clearly stated, FluencyJet Sentence Master does not provide a
        government-recognized or university-recognized certification.
      </p>

      <h2>4. Accuracy of content</h2>
      <p>
        We try to keep lessons and explanations accurate and useful. However,
        errors may occasionally occur. We may update or improve content at any
        time.
      </p>

      <h2>5. User responsibility</h2>
      <p>
        Learners are responsible for practicing regularly and applying what they
        learn in real-life communication.
      </p>

      <h2>6. Contact</h2>
      <p>
        For questions, contact{" "}
        <a href="mailto:support@fluencyjet.com">support@fluencyjet.com</a>.
      </p>
    </LegalLayout>
  );
}
