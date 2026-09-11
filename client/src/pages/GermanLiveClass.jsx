import React from "react";
import "./GermanLiveClass.css";

const RAZORPAY_URL = "ADD_RAZORPAY_LINK_HERE";

function goToPayment() {
  if (RAZORPAY_URL === "ADD_RAZORPAY_LINK_HERE") {
    alert("Razorpay payment link will be added here.");
    return;
  }
  window.location.href = RAZORPAY_URL;
}

const days = [
  {
    day: "DAY 1",
    date: "Friday, September 18",
    time: "7:00 PM – 8:00 PM",
    title: "Meet & Introduce Yourself",
    points: [
      "German greetings",
      "Introduce yourself",
      "Country, residence & languages",
      "4 useful personal questions",
      "German alphabet exposure",
      "Spell your own name",
      "Basic German pronunciation"
    ],
    outcome: "Build your first German self-introduction."
  },
  {
    day: "DAY 2",
    date: "Saturday, September 19",
    time: "7:00 PM – 8:00 PM",
    title: "Build Your Personal Profile",
    points: [
      "Numbers 0–20",
      "Profession / Beruf",
      "Ich bin …",
      "Selected forms of sein",
      "Was sind Sie von Beruf?",
      "Simple yes/no questions",
      "Telephone-number recognition"
    ],
    outcome: "Start speaking about yourself in simple German."
  },
  {
    day: "DAY 3",
    date: "Sunday, September 20",
    time: "11:00 AM – 12:30 PM",
    title: "Put Everything Together",
    points: [
      "Retrieve Day 1 + Day 2",
      "Simple hobbies",
      "Ich lese gern.",
      "Was machen Sie gern?",
      "Basic family vocabulary",
      "Functional haben",
      "Listening, Reading, Writing & Speaking"
    ],
    outcome: "Experience how the pieces come together towards German A1."
  }
];

export default function GermanLiveClass() {
  return (
    <div className="glc-page">

      <div className="glc-flag">
        <div></div>
        <div></div>
        <div></div>
      </div>

      {/* HERO */}
      <section className="glc-hero">
        <div className="glc-container glc-hero-grid">

          <div>
            <div className="glc-eyebrow">
              🇩🇪 3-DAY LIVE GERMAN A1 STARTER PROGRAM
            </div>

            <h1>
              Start German in
              <span> 3 Days</span>
            </h1>

            <p className="glc-hero-text">
              Build and speak your first German sentences — even if you know
              <strong> zero German today.</strong>
            </p>

            <div className="glc-pills">
              <span>✓ LIVE Online</span>
              <span>✓ Absolute Beginners</span>
              <span>✓ English + German</span>
              <span>✓ App Practice</span>
            </div>

            <div className="glc-price-box">
              <div>
                <small>Complete 3-Day Program</small>
                <strong>₹199</strong>
              </div>

              <button onClick={goToPayment} className="glc-main-button">
                JOIN THE LIVE CLASS — ₹199
              </button>
            </div>

            <p className="glc-small">
              No prior German knowledge required.
            </p>
          </div>

          <div className="glc-germany-visual">
            <div className="glc-flag-circle">🇩🇪</div>

            <div className="glc-deutsch">DEUTSCH</div>

            <p>Your first step towards German A1 starts here.</p>

            <div className="glc-trainer-small">
              <div className="glc-trainer-avatar">S</div>
              <div>
                <small>LIVE TRAINER</small>
                <strong>Sukanya</strong>
                <span>English + German</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* DATES */}
      <section className="glc-dates">
        <div className="glc-container glc-date-grid">

          <div className="glc-date-card">
            <b>DAY 1</b>
            <h3>Friday, September 18</h3>
            <strong>7:00 PM – 8:00 PM</strong>
            <p>Meet & Introduce Yourself</p>
          </div>

          <div className="glc-date-card">
            <b>DAY 2</b>
            <h3>Saturday, September 19</h3>
            <strong>7:00 PM – 8:00 PM</strong>
            <p>Build Your Personal Profile</p>
          </div>

          <div className="glc-date-card">
            <b>DAY 3</b>
            <h3>Sunday, September 20</h3>
            <strong>11:00 AM – 12:30 PM</strong>
            <p>Integrate, Speak & See Your A1 Roadmap</p>
          </div>

        </div>
      </section>

      {/* PROBLEM */}
      <section className="glc-section glc-soft">
        <div className="glc-container glc-narrow glc-center">

          <div className="glc-section-label">START FROM ZERO</div>

          <h2>
            Want to learn German...
            <br />
            but don't know where to begin?
          </h2>

          <p className="glc-lead">
            German can look difficult at first — new pronunciation, unfamiliar
            words, sentence structures and grammar.
          </p>

          <p className="glc-lead">
            But you don't need to understand all of German before you start
            using it.
          </p>

          <h3 className="glc-red-text">
            You just need the right first steps.
          </h3>

        </div>
      </section>

      {/* DAYS */}
      <section className="glc-section">
        <div className="glc-container">

          <div className="glc-section-label">YOUR 3-DAY JOURNEY</div>

          <h2>Learn. Practise. Retrieve. Speak.</h2>

          <div className="glc-day-grid">

            {days.map((item) => (
              <div className="glc-day-card" key={item.day}>

                <div className="glc-day-label">
                  {item.day}
                </div>

                <h3>{item.title}</h3>

                <div className="glc-day-date">
                  {item.date}
                  <br />
                  {item.time}
                </div>

                <ul>
                  {item.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>

                <div className="glc-outcome">
                  ✓ {item.outcome}
                </div>

              </div>
            ))}

          </div>
        </div>
      </section>

      {/* TRANSFORMATION */}
      <section className="glc-red-section">
        <div className="glc-container glc-two-column">

          <div>
            <div className="glc-section-label glc-yellow">
              BY THE END OF DAY 3
            </div>

            <h2>
              From “I know no German” to your first simple German profile.
            </h2>

            <p>
              You'll practise how to greet someone, introduce yourself, say
              where you live, talk about your profession, hobbies and basic
              family information.
            </p>
          </div>

          <div className="glc-skills">

            <div>
              <span>👂</span>
              Listening
            </div>

            <div>
              <span>📖</span>
              Reading
            </div>

            <div>
              <span>✍️</span>
              Writing
            </div>

            <div>
              <span>🗣️</span>
              Speaking
            </div>

          </div>

        </div>
      </section>

      {/* APP */}
      <section className="glc-section">
        <div className="glc-container glc-two-column">

          <div className="glc-phone-area">

            <div className="glc-phone">

              <small>FluencyJet German Practice</small>

              <div className="glc-phone-title">
                Ich bin ...
              </div>

              <div className="glc-practice-line"></div>
              <div className="glc-practice-line short"></div>

              <button>
                Practise →
              </button>

            </div>

          </div>

          <div>

            <div className="glc-section-label">
              NOT JUST A LIVE CLASS
            </div>

            <h2>
              Practise what you learn.
            </h2>

            <p className="glc-lead">
              Every participant receives
              <strong> 3-day FluencyJet app practice access</strong>.
            </p>

            <p className="glc-lead">
              Learn something with the trainer — then actively practise,
              retrieve and use it.
            </p>

            <div className="glc-learning-loop">
              LIVE TRAINING + APP PRACTICE
            </div>

            <strong className="glc-loop-text">
              Learn → Practise → Retrieve → Use
            </strong>

          </div>

        </div>
      </section>

      {/* WHAT YOU GET */}
      <section className="glc-section glc-soft">
        <div className="glc-container">

          <div className="glc-section-label">
            YOUR ₹199 PROGRAM
          </div>

          <h2>
            Everything you need to start German properly.
          </h2>

          <div className="glc-benefits">

            <div>✓ 3 LIVE German training sessions</div>
            <div>✓ 3.5 hours of guided learning</div>
            <div>✓ Absolute-beginner friendly</div>
            <div>✓ English + German teaching</div>
            <div>✓ 3-day FluencyJet app access</div>
            <div>✓ Day 1 recording</div>
            <div>✓ Day 2 recording</div>
            <div>✓ Private participant WhatsApp group</div>
            <div>✓ German A1 roadmap on Day 3</div>
            <div>✓ Opportunity to continue to full A1</div>

          </div>

          <div className="glc-offer">

            <div>
              <small>3-Day LIVE German A1 Starter</small>
              <strong>₹199</strong>
              <span>One-time workshop fee</span>
            </div>

            <button
              className="glc-main-button"
              onClick={goToPayment}
            >
              START GERMAN IN 3 DAYS
            </button>

          </div>

        </div>
      </section>

      {/* TRAINER */}
      <section className="glc-section">
        <div className="glc-container glc-trainer-grid">

          <div className="glc-photo-placeholder">
            <div>S</div>
            <span>Trainer photo coming soon</span>
          </div>

          <div>

            <div className="glc-section-label">
              YOUR LIVE TRAINER
            </div>

            <h2>Meet Sukanya</h2>

            <p className="glc-lead">
              Sukanya will guide you step by step through this beginner German
              program using clear English explanations and practical German.
            </p>

            <p className="glc-lead">
              The class is designed for learners from anywhere in India.
            </p>

          </div>

        </div>
      </section>

      {/* HONEST POSITIONING */}
      <section className="glc-dark-section">

        <div className="glc-container glc-narrow glc-center">

          <div className="glc-section-label glc-yellow">
            IMPORTANT
          </div>

          <h2>
            This is a German A1 starter.
            <br />
            Not “A1 in 3 days.”
          </h2>

          <p>
            German A1 requires structured learning and practice.
          </p>

          <p>
            These three days help you start correctly, speak your first useful
            German and understand the path towards A1.
          </p>

        </div>

      </section>

      {/* FAQ */}
      <section className="glc-section">

        <div className="glc-container glc-narrow">

          <div className="glc-center">
            <div className="glc-section-label">
              FREQUENTLY ASKED QUESTIONS
            </div>

            <h2>Before you join</h2>
          </div>

          <details className="glc-faq">
            <summary>
              I don't know even one German word. Can I join?
            </summary>
            <p>
              Yes. This program is specifically designed for absolute beginners.
            </p>
          </details>

          <details className="glc-faq">
            <summary>
              In which language will the class be taught?
            </summary>
            <p>
              English will be used for explanations and German for learning
              and practice.
            </p>
          </details>

          <details className="glc-faq">
            <summary>
              Are recordings available?
            </summary>
            <p>
              Day 1 and Day 2 recordings will be available. Day 3 is designed
              primarily as a LIVE interactive session.
            </p>
          </details>

          <details className="glc-faq">
            <summary>
              Do I get FluencyJet app access?
            </summary>
            <p>
              Yes. Participants receive practice access during the 3-day
              program.
            </p>
          </details>

          <details className="glc-faq">
            <summary>
              Will I complete German A1 in three days?
            </summary>
            <p>
              No. This is an A1 starter program. Its purpose is to build your
              foundation and show you how to continue systematically towards A1.
            </p>
          </details>

          <details className="glc-faq">
            <summary>
              What happens after the three days?
            </summary>
            <p>
              On Day 3, we'll explain the full German A1 learning roadmap.
              Participants who want to continue can also learn about our
              complete German A1 program. There is no obligation to join.
            </p>
          </details>

        </div>
      </section>

      {/* FINAL CTA */}
      <section className="glc-final">

        <div className="glc-container glc-narrow glc-center">

          <div className="glc-big-flag">🇩🇪</div>

          <h2>
            Your German journey can start here.
          </h2>

          <p>
            September 18, 19 & 20
            <br />
            LIVE Online • English + German
          </p>

          <div className="glc-final-price">
            ₹199
          </div>

          <button
            className="glc-main-button glc-big-button"
            onClick={goToPayment}
          >
            JOIN THE 3-DAY LIVE CLASS
          </button>

        </div>

      </section>

      {/* MOBILE STICKY */}
      <div className="glc-mobile-sticky">

        <div>
          <small>3-Day LIVE German</small>
          <strong>₹199</strong>
        </div>

        <button onClick={goToPayment}>
          JOIN NOW
        </button>

      </div>

    </div>
  );
}
