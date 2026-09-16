import React from "react";
import "./GermanLiveClass.css";

const RAZORPAY_URL = "https://rzp.io/rzp/U6XIWv3";

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
    date: "Friday, September 25",
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
    date: "Saturday, September 26",
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
    date: "Sunday, September 27",
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

          <div className="glc-hero-copy">

            <div className="glc-eyebrow">
              🇩🇪 3-DAY LIVE GERMAN A1 STARTER • SEPT 25–27
            </div>

            <h1>
              Germany in Your Plans?
              <span> Start With the Language.</span>
            </h1>

            <div className="glc-hero-secondary">
              Start German in 3 Days
            </div>

            <p className="glc-hero-text">
              Build and speak your first German sentences LIVE —
              even if you know
              <strong> zero German today.</strong>
            </p>

            <div className="glc-pills">
              <span>✓ 3 LIVE Classes</span>
              <span>✓ Absolute Beginners</span>
              <span>✓ English + German</span>
              <span>✓ FluencyJet App Practice</span>
            </div>

            <div className="glc-price-box">

              <div>
                <small>Complete 3-Day Program</small>
                <strong>₹199</strong>
              </div>

              <button
                className="glc-main-button"
                onClick={goToPayment}
              >
                JOIN THE LIVE CLASS — ₹199
              </button>

            </div>

            <div className="glc-hero-trust">
              3 LIVE sessions • Day 1 & 2 recordings • Private WhatsApp group
            </div>

          </div>

          <div className="glc-germany-visual">

            <div className="glc-trainer-small">

              <div className="glc-trainer-avatar">
                S
              </div>

              <div>
                <small>LIVE TRAINER</small>
                <strong>Sukanya</strong>
                <span>English + German</span>
              </div>

            </div>

            <div className="glc-germany-small">
              YOUR FIRST STEP
            </div>

            <div className="glc-deutsch">
              DEUTSCH
            </div>

            <p>
              Learn → Practise → Retrieve → Speak
            </p>

          </div>

        </div>
      </section>

      {/* DATES */}
      <section className="glc-dates">
        <div className="glc-container glc-date-grid">

          <div className="glc-date-card">
            <b>DAY 1</b>
            <h3>Friday, September 25</h3>
            <strong>7:00 PM – 8:00 PM</strong>
            <p>Meet & Introduce Yourself</p>
          </div>

          <div className="glc-date-card">
            <b>DAY 2</b>
            <h3>Saturday, September 26</h3>
            <strong>7:00 PM – 8:00 PM</strong>
            <p>Build Your Personal Profile</p>
          </div>

          <div className="glc-date-card">
            <b>DAY 3</b>
            <h3>Sunday, September 27</h3>
            <strong>11:00 AM – 12:30 PM</strong>
            <p>Integrate, Speak & See Your A1 Roadmap</p>
          </div>

        </div>
      </section>

      {/* WHY GERMAN */}
      <section className="glc-section glc-soft">

        <div className="glc-container">

          <div className="glc-section-intro glc-center">

            <div className="glc-section-label">
              WHY START GERMAN?
            </div>

            <h2>
              German Can Open More Than a Language
            </h2>

            <p className="glc-lead">
              Whether your goal is study, career, exams or life connected
              to Germany, the first step is the same:
              <strong> start building your German foundation.</strong>
            </p>

          </div>

          <div className="glc-reason-grid">

            <div className="glc-reason-card">

              <div className="glc-card-icon">
                🎓
              </div>

              <h3>
                Study in Germany
              </h3>

              <p>
                Start building the language foundation that can support
                your studies and everyday communication.
              </p>

            </div>

            <div className="glc-reason-card">

              <div className="glc-card-icon">
                💼
              </div>

              <h3>
                Career Opportunities
              </h3>

              <p>
                German can be useful for professionals exploring
                opportunities connected to German-speaking markets.
              </p>

            </div>

            <div className="glc-reason-card">

              <div className="glc-card-icon">
                🇩🇪
              </div>

              <h3>
                Life in Germany
              </h3>

              <p>
                German can make everyday communication and integration
                easier if Germany is part of your future.
              </p>

            </div>

            <div className="glc-reason-card">

              <div className="glc-card-icon">
                📝
              </div>

              <h3>
                Goethe / CEFR Journey
              </h3>

              <p>
                A1 is the first CEFR milestone. Start with the basics
                and build systematically.
              </p>

            </div>

          </div>

          <div className="glc-inline-cta glc-center">

            <button
              className="glc-main-button"
              onClick={goToPayment}
            >
              START YOUR FIRST 3 DAYS — ₹199
            </button>

          </div>

        </div>

      </section>


      {/* WHO SHOULD JOIN */}
      <section className="glc-section">

        <div className="glc-container">

          <div className="glc-section-intro glc-center">

            <div className="glc-section-label">
              IS THIS FOR YOU?
            </div>

            <h2>
              Start From Wherever You Are Today
            </h2>

          </div>

          <div className="glc-audience-grid">

            <div className="glc-audience-card">

              <div className="glc-card-icon">
                🎓
              </div>

              <h3>
                Students Planning Germany
              </h3>

              <p>
                You want to start preparing before future studies
                or opportunities.
              </p>

            </div>

            <div className="glc-audience-card">

              <div className="glc-card-icon">
                💼
              </div>

              <h3>
                Working Professionals
              </h3>

              <p>
                You are exploring German for career or international
                opportunities.
              </p>

            </div>

            <div className="glc-audience-card">

              <div className="glc-card-icon">
                📝
              </div>

              <h3>
                Future A1 Learners
              </h3>

              <p>
                You want a clear starting point before beginning
                serious A1 preparation.
              </p>

            </div>

            <div className="glc-audience-card">

              <div className="glc-card-icon">
                🌱
              </div>

              <h3>
                Absolute Beginners
              </h3>

              <p>
                You are interested in German but do not know
                where or how to begin.
              </p>

            </div>

          </div>

          <div className="glc-no-experience">

            <strong>No German required.</strong>

            <span>No grammar knowledge required.</span>

            <span>No previous course required.</span>

          </div>

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

      {/* FLUENCYJET DIFFERENCE */}
      <section className="glc-section">

        <div className="glc-container">

          <div className="glc-section-intro glc-center">

            <div className="glc-section-label">
              THE FLUENCYJET DIFFERENCE
            </div>

            <h2>
              Watching German Lessons Is Not Enough.
            </h2>

            <p className="glc-lead">
              To build a language, you need to
              <strong> retrieve and use what you learn.</strong>
            </p>

          </div>

          <div className="glc-learning-system">

            <div className="glc-learning-step">

              <div className="glc-step-number">
                1
              </div>

              <h3>
                LIVE CLASS
              </h3>

              <strong>
                Understand it.
              </strong>

              <p>
                Learn new German clearly with your trainer.
              </p>

            </div>

            <div className="glc-arrow">
              →
            </div>

            <div className="glc-learning-step">

              <div className="glc-step-number">
                2
              </div>

              <h3>
                FLUENCYJET
              </h3>

              <strong>
                Practise it.
              </strong>

              <p>
                Actively work with what you just learned.
              </p>

            </div>

            <div className="glc-arrow">
              →
            </div>

            <div className="glc-learning-step">

              <div className="glc-step-number">
                3
              </div>

              <h3>
                RETRIEVAL
              </h3>

              <strong>
                Remember it.
              </strong>

              <p>
                Bring German back from memory instead of only rewatching.
              </p>

            </div>

            <div className="glc-arrow">
              →
            </div>

            <div className="glc-learning-step">

              <div className="glc-step-number">
                4
              </div>

              <h3>
                SPEAKING
              </h3>

              <strong>
                Use it.
              </strong>

              <p>
                Turn what you know into usable German.
              </p>

            </div>

          </div>

        </div>

      </section>


      {/* APP PRACTICE */}
      <section className="glc-section glc-soft">

        <div className="glc-container glc-two-column">

          <div className="glc-phone-area">

            <div className="glc-phone">

              <small>
                FluencyJet German Practice
              </small>

              <div className="glc-phone-title">
                Ich bin ...
              </div>

              <div className="glc-practice-line"></div>
              <div className="glc-practice-line short"></div>

              <div className="glc-phone-options">

                <span>Listening Practice</span>
                <span>Sentence Practice</span>
                <span>Active Recall</span>

              </div>

              <button>
                Practise →
              </button>

            </div>

          </div>

          <div>

            <div className="glc-section-label">
              3-DAY APP PRACTICE INCLUDED
            </div>

            <h2>
              Don't Just Attend.
              <br />
              Practise What You Learn.
            </h2>

            <p className="glc-lead">
              Every participant receives
              <strong> 3-day FluencyJet German practice access.</strong>
            </p>

            <p className="glc-lead">
              Reinforce what Sukanya teaches LIVE through active
              practice instead of relying only on videos.
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
            <div>✓ Clear roadmap for continuing towards German A1</div>

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

        <div className="glc-container glc-trainer-clean">

          <div>

            <div className="glc-section-label">
              YOUR LIVE TRAINER
            </div>

            <h2>
              Learn LIVE With Sukanya
            </h2>

            <p className="glc-lead">
              Sukanya will guide absolute beginners step by step
              using clear English explanations and practical German.
            </p>

            <p className="glc-lead">
              The goal is not to overwhelm you with grammar.
              The goal is to help you
              <strong> understand, practise and start using German.</strong>
            </p>

          </div>

          <div className="glc-trainer-info-card">

            <div className="glc-trainer-letter">
              S
            </div>

            <h3>
              Sukanya
            </h3>

            <span>
              German Trainer
            </span>

            <div className="glc-trainer-badges">

              <div>
                ✓ English + German
              </div>

              <div>
                ✓ Absolute-Beginner Friendly
              </div>

              <div>
                ✓ LIVE Interactive Teaching
              </div>

              <div>
                ✓ Guided Practice
              </div>

            </div>

          </div>

        </div>

      </section>

      {/* LANGUAGE LEARNING TRACK RECORD */}
      <section className="glc-section glc-proof-section">

        <div className="glc-container">

          <div className="glc-section-intro glc-center">

            <div className="glc-section-label">
              LANGUAGE-LEARNING EXPERIENCE
            </div>

            <h2>
              Experience With Structured Language Learning
            </h2>

            <p className="glc-lead">
              Our broader language-training experience includes past learners
              who have cleared internationally recognised
              <strong> DELF French examinations.</strong>
            </p>

            <p className="glc-proof-disclosure">
              These are broader language-learning results, not German
              Goethe results. German-specific learner results will be
              published as our German cohorts progress.
            </p>

          </div>

          <div className="glc-proof-grid">

            <div className="glc-proof-card">

              <div className="glc-proof-icon">
                🏅
              </div>

              <h3>
                International Exam Experience
              </h3>

              <p>
                Past learners from our language-training work have
                successfully completed recognised language examinations.
              </p>

            </div>

            <div className="glc-proof-card">

              <div className="glc-proof-icon">
                📚
              </div>

              <h3>
                CEFR-Oriented Learning
              </h3>

              <p>
                We understand the importance of structured progression
                from one language level to the next.
              </p>

            </div>

            <div className="glc-proof-card">

              <div className="glc-proof-icon">
                ⚡
              </div>

              <h3>
                Practice, Not Just Videos
              </h3>

              <p>
                FluencyJet combines trainer-led learning with active
                practice and retrieval.
              </p>

            </div>

          </div>

        </div>

      </section>


      {/* REAL URGENCY */}
      <section className="glc-urgency">

        <div className="glc-container glc-narrow glc-center">

          <div className="glc-section-label glc-yellow">
            CLASSES BEGIN FRIDAY, SEPTEMBER 25
          </div>

          <h2>
            Your First German Class Is Just Days Away.
          </h2>

          <p>
            Join all three LIVE sessions and experience German
            before deciding how far you want to take it.
          </p>

          <button
            className="glc-main-button glc-large-button"
            onClick={goToPayment}
          >
            RESERVE MY SEAT — ₹199
          </button>

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
            September 25, 26 & 27
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
