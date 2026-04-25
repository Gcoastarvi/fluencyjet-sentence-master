import React from "react";
import LegalLayout from "./LegalLayout";

export default function RefundPolicy() {
  return (
    <LegalLayout title="Refund Policy" updated="April 25, 2026">
      <p>
        This Refund Policy explains how refund requests are handled for
        FluencyJet Sentence Master.
      </p>

      <h2>1. Free access</h2>
      <p>
        We provide free access to selected lessons or features so that learners
        can try the platform before upgrading.
      </p>

      <h2>2. Paid access</h2>
      <p>
        When you purchase paid access, you are paying for digital educational
        content, practice access, and app features.
      </p>

      <h2>3. Refund window</h2>
      <p>
        Refund requests may be considered within 7 days of purchase if you are
        unable to access the product due to a technical issue that we cannot
        resolve.
      </p>

      <h2>4. Non-refundable cases</h2>
      <p>Refunds may not be provided in these cases:</p>
      <ul>
        <li>You changed your mind after accessing the content.</li>
        <li>You did not practice or use the product after purchase.</li>
        <li>You expected a guaranteed fluency result.</li>
        <li>You shared your account or misused the platform.</li>
        <li>The refund request is made after the refund window.</li>
      </ul>

      <h2>5. Technical issues</h2>
      <p>
        If you face access or technical problems, please contact support first.
        We will try to resolve the issue before considering a refund.
      </p>

      <h2>6. How to request a refund</h2>
      <p>
        Email us at{" "}
        <a href="mailto:support@fluencyjet.com">support@fluencyjet.com</a> with
        your registered email, payment details, and reason for the request.
      </p>

      <h2>7. Processing time</h2>
      <p>
        Approved refunds may take several working days to reflect, depending on
        your bank or payment provider.
      </p>
    </LegalLayout>
  );
}
