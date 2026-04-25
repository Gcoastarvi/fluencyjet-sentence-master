import React from "react";
import LegalLayout from "./LegalLayout";

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" updated="April 25, 2026">
      <p>
        This Privacy Policy explains how FluencyJet Sentence Master collects,
        uses, stores, and protects information when you use our website and web
        app.
      </p>

      <h2>1. Information we collect</h2>
      <p>We may collect the following types of information:</p>
      <ul>
        <li>Name and email address when you create an account.</li>
        <li>Login and account information.</li>
        <li>
          Learning activity such as level check results, lessons, XP, streaks,
          and progress.
        </li>
        <li>Payment-related information through our payment provider.</li>
        <li>
          Device, browser, page view, and usage information through analytics
          tools.
        </li>
      </ul>

      <h2>2. How we use your information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Create and manage your account.</li>
        <li>Show your lessons, progress, XP, streaks, and dashboard.</li>
        <li>Improve the app experience and learning flow.</li>
        <li>Provide customer support.</li>
        <li>Send important service-related communication.</li>
        <li>Measure website performance and advertising effectiveness.</li>
      </ul>

      <h2>3. Analytics and advertising tools</h2>
      <p>
        We use tools such as Google Analytics and Meta Pixel to understand how
        visitors use our website, measure campaign performance, and improve our
        marketing. These tools may use cookies, pixels, and similar technologies
        to collect information about page views, clicks, device details, browser
        details, and website interactions.
      </p>

      <h2>4. Cookies and tracking</h2>
      <p>
        Cookies and similar technologies help us remember preferences, analyze
        usage, and understand whether our ads are effective. You can control or
        disable cookies through your browser settings. Some parts of the website
        may not work properly if cookies are disabled.
      </p>

      <h2>5. Payments</h2>
      <p>
        Payments may be processed by third-party payment providers such as
        Razorpay or other providers we use. We do not store your full card, UPI,
        or banking details on our servers.
      </p>

      <h2>6. Sharing of information</h2>
      <p>
        We do not sell your personal information. We may share limited
        information with trusted service providers who help us operate the
        website, process payments, provide analytics, deliver ads, or provide
        support.
      </p>

      <h2>7. Children and students</h2>
      <p>
        FluencyJet Sentence Master is intended to be used with appropriate
        consent where required by law. If a learner is below the legally
        required age for giving consent, a parent or guardian should provide
        consent and supervise use of the service.
      </p>

      <h2>8. Data security</h2>
      <p>
        We take reasonable steps to protect user information. However, no method
        of online transmission or storage is 100% secure.
      </p>

      <h2>9. Your choices</h2>
      <p>
        You may contact us to request access, correction, or deletion of your
        account information, subject to applicable law and operational
        requirements.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. The latest version
        will always be available on this page.
      </p>

      <h2>11. Contact</h2>
      <p>
        For privacy questions, contact us at{" "}
        <a href="mailto:support@fluencyjet.com">support@fluencyjet.com</a>.
      </p>
    </LegalLayout>
  );
}
