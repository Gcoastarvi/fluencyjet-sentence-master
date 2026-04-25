import React from "react";
import LegalLayout from "./LegalLayout";

export default function Contact() {
  return (
    <LegalLayout title="Contact Us">
      <p>
        If you have questions about FluencyJet Sentence Master, your account,
        payments, access, or support, please contact us.
      </p>

      <h2>Support email</h2>
      <p>
        Email:{" "}
        <a href="mailto:fluencyjet@gmail.com">fluencyjet@gmail.com</a>
      </p>

      <h2>Business</h2>
      <p>
        FluencyJet Educational Services
        <br />
        India
      </p>

      <h2>Response time</h2>
      <p>
        We usually try to respond within 2–3 working days. During launch periods
        or live campaigns, response times may vary.
      </p>
    </LegalLayout>
  );
}
