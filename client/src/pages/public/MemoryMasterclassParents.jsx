import MemoryOfferVisibility from "../../components/memory/MemoryOfferVisibility";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "../../lib/tracking";
import MemoryStandaloneCheckout from "../../components/memory/MemoryStandaloneCheckout";
import { useMemoryMasterclassEvent } from "../../hooks/useMemoryMasterclassEvent";
import { getMemoryVslId } from "../../data/memory/masterclassConfig";
import "./MemoryMasterclassParents.css";

const EVENT_DATE = "2026-10-25";

const GRADES = [
  { label: "6th", grade: "6", track: "school_foundation" },
  { label: "7th", grade: "7", track: "school_foundation" },
  { label: "8th", grade: "8", track: "school_foundation" },
  { label: "9th", grade: "9", track: "school_advanced" },
  { label: "10th", grade: "10", track: "school_advanced" },
  { label: "11th", grade: "11", track: "school_advanced" },
  { label: "12th", grade: "12", track: "school_advanced" },
  { label: "College", grade: "college", track: "advanced" },
  { label: "Competitive Exams", grade: "exams", track: "advanced" },
];

const BENEFITS = [
  { icon: "brain", title: "Remember Better", desc: "Simple memory techniques" },
  { icon: "book", title: "Recall Without the Book", desc: "Practise remembering answers" },
  { icon: "repeat", title: "Revise Smarter", desc: "Better revision methods" },
  { icon: "graduation", title: "Apply to Studies", desc: "Use the methods in school lessons" },
];

const QUESTIONS = [
  {
    q: "Is this class right for my child?",
    a: "The live class is designed for students in Classes 6–12. The Memory Test also has a separate Advanced track for college and competitive exam learners."
  },
  {
    q: "Must my child take the first test before booking?",
    a: "No. You can book the ₹99 live class now and your child can take the starting test before the class."
  },
  {
    q: "Are the tests the same for every student?",
    a: "No. Classes 6–8, Classes 9–12 and Advanced learners have three separate challenges. Each has its own matching second test."
  },
  {
    q: "Will my child's memory improve in two hours?",
    a: "The class teaches practical techniques and gives learners a chance to try them. Continued practice is important, and improvement is not guaranteed."
  },
  {
    q: "Does a low test score mean low intelligence?",
    a: "Not at all. A score reflects performance on the specific memory activities, not your child's intelligence or overall learning ability."
  },
];

function BenefitIcon({ name }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 28,
    height: 28,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  if (name === "brain") {
    return (
      <svg {...common}>
        <path d="M12 18V5a3 3 0 0 0-5.7-1.3A4 4 0 0 0 3 10a4 4 0 0 0 1 6 4 4 0 0 0 6.5 4.2L12 18Z" />
        <path d="M12 18V5a3 3 0 0 1 5.7-1.3A4 4 0 0 1 21 10a4 4 0 0 1-1 6 4 4 0 0 1-6.5 4.2L12 18Z" />
        <path d="M8 9c-1.5 0-2.5 1-2.5 2.5M16 9c1.5 0 2.5 1 2.5 2.5M8 15l2 1M16 15l-2 1" />
      </svg>
    );
  }

  if (name === "book") {
    return (
      <svg {...common}>
        <path d="M12 7c-2-1.5-5-2-9-1.5v13c4-.5 7 0 9 1.5" />
        <path d="M12 7c2-1.5 5-2 9-1.5v13c-4-.5-7 0-9 1.5" />
        <path d="M12 7v13M6 10h3M15 10h3" />
      </svg>
    );
  }

  if (name === "repeat") {
    return (
      <svg {...common}>
        <path d="M20 8a8 8 0 0 0-14-3L4 7" />
        <path d="M4 3v4h4" />
        <path d="M4 16a8 8 0 0 0 14 3l2-2" />
        <path d="M20 21v-4h-4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="m2 9 10-5 10 5-10 5L2 9Z" />
      <path d="M6 11v5c3.8 3.2 8.2 3.2 12 0v-5" />
      <path d="M22 9v7" />
    </svg>
  );
}

function Step({ number, title, detail, tone }) {
  return (
    <div className={`bdp-process-step ${tone || ""}`}>
      <span className="bdp-process-number">{number}</span>
      <strong>{title}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function MemoryMasterclassParents() {
  const navigate = useNavigate();
  const offerVisit = useRef(false);
  const { event, error, retry } = useMemoryMasterclassEvent();

  const [grade, setGrade] = useState(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(-1);

  const activeGrade = GRADES.find((item) => item.grade === grade);

  const expectedEvent = Boolean(
    event && String(event.dateISO).slice(0, 10) === EVENT_DATE
  );

  const videoCandidate = getMemoryVslId("school");
  const videoId = /^\d+$/.test(String(videoCandidate ?? ""))
    ? String(videoCandidate)
    : null;

  const goToTest = () => {
    if (!activeGrade) return;

    // The nine selections lead to three existing assessment tracks.
    // Never invent a separate test for an individual grade.
    const allowedTracks = [
      "school_foundation",
      "school_advanced",
      "advanced",
    ];

    const selectedTrack = activeGrade.track;

    if (!allowedTracks.includes(selectedTrack)) {
      window.alert("Please choose a valid class or category.");
      return;
    }

    // Clear old assessment answers and tokens before a new attempt.
    const previousAssessmentKeys = [
      "memory_form_a_immediate_answers",
      "memory_form_a_ordered_answers",
      "memory_form_a_association_answers",
      "memory_form_a_academic_answers",
      "memory_form_a_delayed_answers",
      "memory_form_a_result",
      "memory_form_a_public_token",
      "memory_form_a_owner_token",
      "memory_form_a_lead_saved",
    ];

    try {
      for (const key of previousAssessmentKeys) {
        window.sessionStorage.removeItem(key);
      }

      window.sessionStorage.setItem("memory_track", selectedTrack);

      if (
        window.sessionStorage.getItem("memory_track")
        !== selectedTrack
      ) {
        throw new Error("Assessment selection was not saved.");
      }
    } catch {
      window.alert(
        "Unable to save your test selection. " +
        "Please allow browser session storage and try again."
      );
      return;
    }

    // Preserve the existing assessment selection analytics.
    // Tracking must not prevent the learner from starting.
    try {
      trackEvent("memory_track_selected", {
        funnel: "amaze_memory",
        track: selectedTrack,
        source: "memory_masterclass_parents",
      });
    } catch {
      // Tracking is optional; assessment navigation still proceeds.
    }

    // Skip the duplicated level selector.
    // Preserve the existing introduction and five-part test.
    navigate("/memory-challenge/start", {
      state: { fromTrackSelection: true },
    });
  };

  return (
    <MemoryStandaloneCheckout
      audience="school"
      parentsMode
      event={expectedEvent ? event : null}
    >
      {({ openCheckout, busy, dialogOpen }) => {
        const bookingDisabled = !expectedEvent || busy;

        const booking = (extraClass = "") => (
          <MemoryOfferVisibility ready={expectedEvent} blocked={dialogOpen || busy}
            visit={offerVisit} source="memory_masterclass_parents" placement="parents">
          <button
            type="button"
            className={`bdp-buy ${extraClass}`}
            onClick={openCheckout}
            disabled={bookingDisabled}
          >
            Book My Child's Seat <span aria-hidden="true">—</span> ₹99
            <span aria-hidden="true"> →</span>
          </button>
          </MemoryOfferVisibility>
        );

        return (
          <div className="bdp" id="top">

            <div className="bdp-topline">
              LIVE ONLINE · SUNDAY, 25 OCTOBER 2026 · 5–7 PM IST
            </div>

            <header className="bdp-header bdp-wrap">
              <a
                href="#top"
                className="bdp-logo"
                aria-label="BrainoDad, back to top"
              >
                BRAINO<span>DAD</span>
                <small>Study Memory Masterclass</small>
              </a>

              <a href="#choose-grade" className="bdp-header-link">
                Memory Test <span aria-hidden="true">↗</span>
              </a>
            </header>

            {/* B1 - HERO */}

            <section
              className="bdp-section bdp-hero"
              aria-labelledby="bdp-hero-title"
            >
              <div className="bdp-wrap bdp-hero-layout">

                <div className="bdp-hero-copy">
                  <p className="bdp-eyebrow">
                    FOR STUDENTS IN CLASSES 6–12
                  </p>

                  <h1 id="bdp-hero-title">
                    Your Child Studies Hard.
                    <span> But How Much Do They Remember?</span>
                  </h1>

                  <p className="bdp-hero-sub">
                    Give your child a smarter way to study—in just 2 hours.
                  </p>

                  <p className="bdp-date">
                    <span aria-hidden="true">◷</span>
                    Sunday, 25 October · 5–7 PM IST
                    <span className="bdp-live">LIVE ONLINE</span>
                  </p>

                  <div className="bdp-hero-price">
                    <span>2-hour live class</span>
                    <strong>₹99</strong>
                  </div>

                  {booking("bdp-buy-hero")}

                  <p className="bdp-tiny">
                    {import.meta.env.DEV
                      ? "Preview only — payment submissions are blocked."
                      : "Live online · Secure Razorpay checkout."}
                  </p>
                </div>

                <div
                  className="bdp-hero-art bdp-hero-experience bdp-original-hero"
                  aria-label="First Memory Test, Attend Live Class, Second Memory Test"
                >

                  <p className="bdp-experience-eyebrow">
                    THE STUDY MEMORY EXPERIENCE
                  </p>

                  <h2 className="bdp-experience-title">
                    Test your memory.<br />
                    <span>Learn new methods.</span><br />
                    Test again.
                  </h2>

                  <div className="bdp-experience-steps">

                    <div className="bdp-experience-step bdp-experience-before">
                      <span className="bdp-experience-kicker">
                        01
                      </span>

                      <strong className="bdp-experience-name">
                        1st Memory Test
                      </strong>

                      <small>Starting score</small>
                    </div>

                    <span
                      className="bdp-experience-arrow"
                      aria-hidden="true"
                    >
                      →
                    </span>

                    <div className="bdp-experience-step bdp-experience-live">
                      <span className="bdp-experience-kicker">
                        02
                      </span>

                      <strong className="bdp-experience-name">
                        Attend Live Class
                      </strong>

                      <small>2 hours</small>
                    </div>

                    <span
                      className="bdp-experience-arrow"
                      aria-hidden="true"
                    >
                      →
                    </span>

                    <div className="bdp-experience-step bdp-experience-after">
                      <span className="bdp-experience-kicker">
                        03
                      </span>

                      <strong className="bdp-experience-name">
                        2nd Memory Test
                      </strong>

                      <small>Compare scores</small>
                    </div>

                  </div>

                  <p className="bdp-experience-note">
                    See your child's results before and after the class.
                  </p>

                </div>

              </div>
            </section>

            {/* B2 - PROBLEM */}

            <section
              className="bdp-section bdp-problem"
              aria-labelledby="bdp-problem-title"
            >
              <div className="bdp-wrap">

                <h2 className="bdp-center" id="bdp-problem-title">
                  Does This Happen to Your Child?
                </h2>

                <div className="bdp-three bdp-pain-cards">
                  <article className="bdp-pain">
                    <span className="bdp-icon" aria-hidden="true">↶</span>
                    <h3>Studies today.<br />Forgets tomorrow.</h3>
                  </article>

                  <article className="bdp-pain">
                    <span className="bdp-icon" aria-hidden="true">↻</span>
                    <h3>Reads again and again.<br />Still forgets.</h3>
                  </article>

                  <article className="bdp-pain">
                    <span className="bdp-icon" aria-hidden="true">?</span>
                    <h3>Knows at home.<br />Forgets in the exam.</h3>
                  </article>
                </div>

                <p className="bdp-problem-end">
                  It's not about studying more.
                  <strong> It's about studying better.</strong>
                </p>

              </div>
            </section>

            {/* B3 - MEMORY TEST SELECTOR */}

            <section
              className="bdp-section bdp-assessment"
              id="choose-grade"
              aria-labelledby="bdp-assessment-title"
            >
              <div className="bdp-wrap bdp-assessment-wrap">

                <div className="bdp-section-heading">
                  <p className="bdp-eyebrow">
                    START WITH A MEMORY TEST
                  </p>

                  <h2 id="bdp-assessment-title">
                    Take the Memory Test With Your Child
                  </h2>

                  <p>Choose a class or learning category below.</p>
                </div>

                <div className="bdp-picker">
                  <div
                    className="bdp-grade-grid"
                    role="group"
                    aria-label="Choose a class or learning category"
                  >
                    {GRADES.map((item) => {
                      const chosen = grade === item.grade;

                      return (
                        <button
                          type="button"
                          key={item.grade}
                          className={
                            `bdp-grade ${
                              item.track === "advanced"
                                ? "bdp-grade-advanced"
                                : ""
                            } ${chosen ? "bdp-grade-selected" : ""}`
                          }
                          aria-pressed={chosen}
                          onClick={() => setGrade(item.grade)}
                        >
                          {item.label}

                          {chosen && (
                            <span className="bdp-tick" aria-hidden="true">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {activeGrade && (
                    <p className="bdp-selected-note" role="status">
                      Selected: <strong>{activeGrade.label}</strong>
                      {" · "}
                      {activeGrade.track === "advanced"
                        ? "Advanced"
                        : activeGrade.track === "school_foundation"
                        ? "Class 6–8"
                        : "Class 9–12"}
                      {" Memory Challenge"}
                    </p>
                  )}

                  <button
                    type="button"
                    className="bdp-test-button"
                    disabled={!activeGrade}
                    onClick={goToTest}
                  >
                    {activeGrade
                      ? `Start ${activeGrade.label} Memory Test →`
                      : "Select a Class to Start →"}
                  </button>

                  <p className="bdp-picker-note">
                    5 memory activities · Starting score out of 100
                  </p>
                </div>

                <p className="bdp-assessment-disclaimer">
                  Classes 6–8, 9–12 and Advanced each have a different
                  challenge and matching retest. Scores measure specific
                  memory activities, not intelligence.
                  Improvement is not guaranteed.
                </p>

                <div className="bdp-book-first">
                  <p>
                    Child not at home? Book the live class now.
                    Take the test later.
                  </p>
                  {booking()}
                </div>

              </div>
            </section>

            {/* B4 - BENEFITS */}

            <section
              className="bdp-section bdp-benefits"
              aria-labelledby="bdp-benefits-title"
            >
              <div className="bdp-wrap">
                <h2 className="bdp-center" id="bdp-benefits-title">
                  Four Skills. One Live Class.
                </h2>

                <div className="bdp-four">
                  {BENEFITS.map(({ icon, title, desc }) => (
                    <article className="bdp-benefit" key={title}>
                      <span className="bdp-benefit-number">
                        <BenefitIcon name={icon} />
                      </span>
                      <h3>{title}</h3>
                      <p>{desc}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            {/* B5 - TRAINER CREDIBILITY */}

            <section
              className="bdp-section bdp-trainer"
              aria-labelledby="bdp-trainer-title"
            >
              <div className="bdp-wrap bdp-trainer-grid">

                <figure className="bdp-trainer-portrait">
                  <img
                    src="/images/memory-challenge-hero.webp"
                    alt="Aravind Pasupathy holding his Guinness World Record certificate"
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>
                    Authentic Guinness World Record certificate
                  </figcaption>
                </figure>

                <div>
                  <p className="bdp-eyebrow">MEET YOUR TRAINER</p>

                  <h2 id="bdp-trainer-title">
                    Learn from a Guinness World Record Holder
                  </h2>

                  <h3>Aravind Pasupathy</h3>

                  <p>
                    Memory Trainer since 2011 · Founder, BrainoDad
                  </p>

                  <blockquote>
                    This class is about helping your child learn and
                    practise useful memory techniques—not showing
                    off a world record.
                  </blockquote>
                </div>

              </div>
            </section>

            {/* B6 - VIDEO */}

            <section
              className="bdp-section bdp-video"
              aria-labelledby="bdp-video-title"
            >
              <div className="bdp-wrap bdp-narrow bdp-center">

                <h2 id="bdp-video-title">
                  See How It Works in 4 Minutes
                </h2>

                <div className="bdp-video-box">
                  {videoId && videoOpen ? (
                    <iframe
                      title="BrainoDad school memory class video"
                      src={`https://player.vimeo.com/video/${videoId}?autoplay=1`}
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  ) : videoId ? (
                    <button
                      type="button"
                      className="bdp-video-poster"
                      onClick={() => setVideoOpen(true)}
                      aria-label="Play BrainoDad four minute video"
                    >
                      <img className="bdp-vimeo-poster" src="/images/brainodad-vimeo-1234364593-poster.jpg" alt="Preview image from the BrainoDad memory video" loading="lazy" decoding="async" />
                      <span className="bdp-play" aria-hidden="true">▶</span>
                      <strong>Watch the 4-Minute Video</strong>
                    </button>
                  ) : (
                    <div className="bdp-video-poster bdp-video-missing">
                      <p>Watch the class preview</p>
                      <a href="/memory-challenge/video/school">
                        Open the existing school video →
                      </a>
                    </div>
                  )}
                </div>

                <p className="bdp-video-caption">
                  4-minute class preview. Watching is optional.
                  The live class is a separate ₹99 registration.
                </p>

              </div>
            </section>

            {/* B6.5 - ORIGINAL MEMORY TRAINING FEEDBACK */}

            <section
              className="bdp-section bdp-feedback"
              aria-labelledby="bdp-feedback-heading"
            >
              <div className="bdp-wrap bdp-narrow bdp-center">

                <p className="bdp-eyebrow">
                  GENUINE VIDEO FEEDBACK
                </p>

                <h2 id="bdp-feedback-heading">
                  Memory Training Feedback
                </h2>

                <p className="bdp-feedback-lead">
                  Watch an original feedback video from our memory training.
                </p>

                <div className="bdp-video-box bdp-feedback-video">

                  {feedbackOpen ? (
                    <iframe
                      title="Memory Training Feedback video"
                      src="https://player.vimeo.com/video/905848237?autoplay=1&amp;title=0&amp;byline=0&amp;portrait=0"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  ) : (
                    <button
                      type="button"
                      className="bdp-video-poster bdp-feedback-poster"
                      onClick={() => setFeedbackOpen(true)}
                      aria-label="Play original memory training feedback video"
                    >
                      <img className="bdp-vimeo-poster" src="/images/brainodad-vimeo-905848237-poster.jpg" alt="Thumbnail from original Memory Training Feedback video" loading="lazy" decoding="async" />
                      <span className="bdp-play" aria-hidden="true">
                        ▶
                      </span>
                      <strong>Watch Memory Training Feedback</strong>
                    </button>
                  )}

                </div>

                <p className="bdp-feedback-caption">
                  Real video feedback. No claims of guaranteed results.
                </p>

              </div>
            </section>

            {/* B7 - OFFER */}

            <section
              className="bdp-section bdp-offer"
              id="booking"
              aria-labelledby="bdp-offer-title"
            >
              <div className="bdp-wrap bdp-offer-wrap">

                <p className="bdp-eyebrow">
                  LIVE STUDY MEMORY MASTERCLASS
                </p>

                <h2 id="bdp-offer-title">
                  Everything Included for ₹99
                </h2>

                <div className="bdp-offer-panel">
                  <ul>
                    <li>2-Hour Live Memory Class</li>
                    <li>1st Study Memory Test</li>
                    <li>Practical Memory Techniques</li>
                    <li>2nd Study Memory Test</li>
                    <li>Before &amp; After Score Comparison</li>
                  </ul>

                  <div className="bdp-offer-summary">
                    <span>
                      Sunday, 25 October 2026 · 5–7 PM IST
                    </span>

                    <strong>₹99</strong>

                    {booking()}

                    <small>
                      Live online · Secure Razorpay checkout
                    </small>
                    <small className="bdp-joining-note">
                      After booking, follow your confirmation page
                      for live-class joining instructions.
                    </small>
                  </div>
                </div>

              </div>
            </section>

            {/* B8 - FAQ */}

            <section
              className="bdp-section bdp-faq-section"
              aria-labelledby="bdp-faq-title"
            >
              <div className="bdp-wrap bdp-narrow">

                <h2 className="bdp-center" id="bdp-faq-title">
                  Questions Parents Ask
                </h2>

                <div className="bdp-faq-list">
                  {QUESTIONS.map((item, index) => (
                    <div className="bdp-faq" key={item.q}>
                      <button
                        type="button"
                        aria-expanded={faqOpen === index}
                        onClick={() =>
                          setFaqOpen(faqOpen === index ? -1 : index)
                        }
                      >
                        <span>{item.q}</span>
                        <span aria-hidden="true">
                          {faqOpen === index ? "−" : "+"}
                        </span>
                      </button>

                      {faqOpen === index && <p>{item.a}</p>}
                    </div>
                  ))}
                </div>

                <div className="bdp-final">
                  <h2>Give Your Child a Smarter Way to Study.</h2>

                  <p>
                    Sunday, 25 October · 5–7 PM IST · Live Online
                  </p>

                  {booking()}
                </div>

              </div>
            </section>

            <footer className="bdp-footer">
              <strong>BRAINODAD</strong>
              <p>
                Educational training and activity-specific memory tests.
                Results vary; no improvement guaranteed.
                <a href="/memory-challenge" target="_blank" rel="noopener noreferrer" className="mt-2 block w-fit rounded py-2 underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Privacy choices (opens in a new tab)</a>
              </p>
            </footer>

            {!dialogOpen && (
              <div className="bdp-sticky">
                <button
                  type="button"
                  className="bdp-buy bdp-buy-sticky"
                  onClick={() => {
                    document.getElementById("choose-grade")?.scrollIntoView({
                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "auto"
                        : "smooth",
                      block: "start",
                    });
                  }}
                >
                  Try the Free Memory Test →
                </button>
              </div>
            )}

            {(!event || error || !expectedEvent) && (
              <div className="bdp-event-status" role="status">
                <strong>
                  {event && !expectedEvent
                    ? "Booking paused: class date differs"
                    : error
                    ? "Booking details unavailable"
                    : "Checking class schedule…"}
                </strong>

                <span>
                  {event && !expectedEvent
                    ? "Confirm the October 25 event in the existing scheduling system."
                    : error
                    ? "Please retry to load the schedule."
                    : "The ₹99 buttons activate after schedule verification."}
                </span>

                {error && (
                  <button type="button" onClick={retry}>
                    Retry
                  </button>
                )}
              </div>
            )}

          </div>
        );
      }}
    </MemoryStandaloneCheckout>
  );
}

