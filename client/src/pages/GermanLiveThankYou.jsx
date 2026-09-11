import React from "react";
import "./GermanLiveClass.css";

const WHATSAPP_GROUP_URL = "ADD_WHATSAPP_GROUP_LINK_HERE";

function joinWhatsApp() {
  if (WHATSAPP_GROUP_URL === "ADD_WHATSAPP_GROUP_LINK_HERE") {
    alert("WhatsApp group link will be added here.");
    return;
  }

  window.location.href = WHATSAPP_GROUP_URL;
}

export default function GermanLiveThankYou() {
  return (
    <div className="glc-page glc-thankyou-page">

      <div className="glc-flag">
        <div></div>
        <div></div>
        <div></div>
      </div>

      <div className="glc-thankyou-wrap">

        <div className="glc-thankyou-card">

          <div className="glc-success">
            ✓
          </div>

          <div className="glc-section-label">
            REGISTRATION CONFIRMED
          </div>

          <h1>
            Willkommen! 🎉
          </h1>

          <p className="glc-lead">
            You're registered for
            <strong> Start German in 3 Days.</strong>
          </p>

          <div className="glc-whatsapp-box">

            <div className="glc-important">
              IMPORTANT NEXT STEP
            </div>

            <h2>
              Join the Private WhatsApp Group
            </h2>

            <p>
              Class links, reminders, app access information, recordings and
              important announcements will be shared inside this group.
            </p>

            <button
              className="glc-whatsapp-button"
              onClick={joinWhatsApp}
            >
              JOIN THE WHATSAPP GROUP →
            </button>

            <small>
              Please join the group before closing this page.
            </small>

          </div>

          <div className="glc-save-dates">

            <h2>
              Save These Dates
            </h2>

            <div className="glc-reminder-grid">

              <div>
                <strong>Friday, Sep 18</strong>
                <span>7:00 PM – 8:00 PM</span>
              </div>

              <div>
                <strong>Saturday, Sep 19</strong>
                <span>7:00 PM – 8:00 PM</span>
              </div>

              <div>
                <strong>Sunday, Sep 20</strong>
                <span>11:00 AM – 12:30 PM</span>
              </div>

            </div>

          </div>

          <div className="glc-next-steps">

            <h2>
              What to do now
            </h2>

            <ol>
              <li>Join the participant WhatsApp group.</li>
              <li>Save all three LIVE class timings.</li>
              <li>Watch for your preparation and app-access message.</li>
              <li>Attend Day 1 LIVE.</li>
            </ol>

          </div>

          <button
            className="glc-whatsapp-button glc-full-button"
            onClick={joinWhatsApp}
          >
            JOIN WHATSAPP GROUP
          </button>

          <div className="glc-bis-bald">
            Bis bald! 🇩🇪
          </div>

        </div>

      </div>

    </div>
  );
}
