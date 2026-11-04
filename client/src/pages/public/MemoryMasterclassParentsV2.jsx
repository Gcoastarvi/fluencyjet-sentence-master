import { memoryBookingOpen, memoryScheduleLabel } from "../../lib/memorySchedule";
import MemoryOfferVisibility from "../../components/memory/MemoryOfferVisibility";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "../../lib/tracking";
import MemoryStandaloneCheckout from "../../components/memory/MemoryStandaloneCheckout";
import { useMemoryMasterclassEvent } from "../../hooks/useMemoryMasterclassEvent";
import { getMemoryVslId } from "../../data/memory/masterclassConfig";
// Variant B of /memory-masterclass/parents for A/B testing; shares its stylesheet.
import "./MemoryMasterclassParents.css";


// Three choices map one-to-one onto the three existing assessment tracks.
const GRADES = [
  {
    label: "Class 6–8",
    grade: "6-8",
    track: "school_foundation",
    sub: "Foundation memory challenge",
  },
  {
    label: "Class 9–12",
    grade: "9-12",
    track: "school_advanced",
    sub: "For the board-exam years",
  },
  {
    label: "College & Competitive Exams",
    grade: "advanced",
    track: "advanced",
    sub: "Advanced memory challenge",
  },
];

const PAINS = [
  {
    icon: "↻",
    title: "Reads the chapter again and again.",
    detail: "By the next morning, most of it is gone.",
  },
  {
    icon: "?",
    title: "Knows the answers at home.",
    detail: "Goes blank in the exam hall.",
  },
  {
    icon: "◷",
    title: "Long hours at the study table.",
    detail: "The marks don't match the effort.",
  },
  {
    icon: "!",
    title: "“Go and study!” every evening.",
    detail: "And it ends in an argument.",
  },
];

const WHY_POINTS = [
  {
    title: "Re-reading feels like learning.",
    detail:
      "The page looks familiar, so it feels remembered. But recognising a page is not the same as recalling it.",
  },
  {
    title: "Exams demand recall.",
    detail:
      "With a blank answer sheet, your child has to pull the answer out of memory, a skill most students never practise.",
  },
  {
    title: "Memory techniques give the brain hooks.",
    detail:
      "Pictures, stories and self-testing help information stick. These can be taught, and your child practises them live.",
  },
];

const BENEFITS = [
  {
    icon: "brain",
    title: "Remember Better",
    desc: "Turn lessons into pictures and stories the brain holds on to.",
  },
  {
    icon: "book",
    title: "Recall Without the Book",
    desc: "Practise pulling answers from memory, the way exams demand.",
  },
  {
    icon: "repeat",
    title: "Revise Smarter",
    desc: "A revision routine built on recall, not endless re-reading.",
  },
  {
    icon: "graduation",
    title: "Apply to Studies",
    desc: "Try the methods on school-style facts, terms and sequences.",
  },
];

const QUESTIONS = [
  {
    q: "Is the memory test really free?",
    a: "Yes. The first memory test is free for every student. You pay ₹99 only if you book the live class."
  },
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

export default function MemoryMasterclassParentsV2() {
  const navigate = useNavigate();
  const offerVisit = useRef(false);
  const { event, error, retry } = useMemoryMasterclassEvent();

  const [grade, setGrade] = useState(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(-1);
  const [offerInView, setOfferInView] = useState(false);
  const [offerEl, setOfferEl] = useState(null);

  // Hide the free-test sticky bar while the ₹99 offer is on screen,
  // so the two calls to action never compete.
  useEffect(() => {
    if (!offerEl || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setOfferInView(
          entry.isIntersecting || entry.boundingClientRect.top < 0
        ),
      { threshold: 0.15 }
    );
    observer.observe(offerEl);
    return () => observer.disconnect();
  }, [offerEl]);

  const scrollToTest = () => {
    try {
      trackEvent("memory_parents_free_test_cta", {
        funnel: "amaze_memory",
        source: "memory_masterclass_parents_v2",
      });
    } catch {
      // Tracking is optional.
    }
    document.getElementById("choose-grade")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  const activeGrade = GRADES.find((item) => item.grade === grade);

  const expectedEvent = memoryBookingOpen(event);
  const scheduleLabel = memoryScheduleLabel(event);

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
        source: "memory_masterclass_parents_v2",
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
            visit={offerVisit} source="memory_masterclass_parents_v2" placement="parents">
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

        const freeTest = (extraClass = "") => (
          <button
            type="button"
            className={`bdp-buy ${extraClass}`}
            onClick={scrollToTest}
          >
            Start the Free Memory Test <span aria-hidden="true">→</span>
          </button>
        );

        return (
          <div className="bdp bdp-v2" id="top">

            <div className="bdp-topline">
              FREE MEMORY TEST OPEN NOW · LIVE CLASS: {scheduleLabel}
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
            </header>

            {/* B1 - HERO: one primary action (free test) */}

            <section
              className="bdp-section bdp-hero"
              aria-labelledby="bdp-hero-title"
            >
              <div className="bdp-wrap bdp-hero-layout">

                <div className="bdp-hero-copy">
                  <p className="bdp-eyebrow">
                    FOR PARENTS OF STUDENTS IN CLASSES 6–12
                  </p>

                  <h1 id="bdp-hero-title">
                    Your Child Studies Hard.
                    <span> But Forgets It by Exam Day.</span>
                  </h1>

                  <p className="bdp-hero-sub">
                    Find out your child's memory score for free. Then join a
                    2-hour live class with a Guinness World Record holder,
                    and see the score again after the class.
                  </p>

                  {freeTest("bdp-free-hero")}

                  <p className="bdp-hero-micro">
                    Free · 5 memory activities · Score out of 100 · No payment needed
                  </p>

                  <ul className="bdp-trust" aria-label="About the trainer">
                    <li><span aria-hidden="true">🏆</span> Guinness World Record holder</li>
                    <li><span aria-hidden="true">👨‍🎓</span> 35,000+ students trained</li>
                    <li><span aria-hidden="true">📅</span> Memory trainer since 2011</li>
                  </ul>

                  <p className="bdp-book-alt">
                    Child not at home right now?{" "}
                    <button
                      type="button"
                      className="bdp-buy-hero bdp-book-link"
                      onClick={openCheckout}
                      disabled={bookingDisabled}
                    >
                      Book the ₹99 live class now
                    </button>
                    {" "}and take the test later.
                  </p>

                  {import.meta.env.DEV && (
                    <p className="bdp-tiny">
                      Preview only — payment submissions are blocked.
                    </p>
                  )}
                </div>

                <div
                  className="bdp-hero-art bdp-hero-experience bdp-original-hero"
                  aria-label="Free memory test, live class, second memory test"
                >

                  <p className="bdp-experience-eyebrow">
                    HOW IT WORKS
                  </p>

                  <h2 className="bdp-experience-title">
                    Test.<br />
                    <span>Learn.</span><br />
                    Test again.
                  </h2>

                  <div className="bdp-experience-steps">

                    <div className="bdp-experience-step bdp-experience-before">
                      <span className="bdp-experience-kicker">
                        01 <em className="bdp-free-pill">FREE</em>
                      </span>
                      <strong className="bdp-experience-name">
                        Memory Test
                      </strong>
                      <small>Get your child's starting score</small>
                    </div>

                    <span className="bdp-experience-arrow" aria-hidden="true">→</span>

                    <div className="bdp-experience-step bdp-experience-live">
                      <span className="bdp-experience-kicker">
                        02 <em className="bdp-price-pill">₹99</em>
                      </span>
                      <strong className="bdp-experience-name">
                        Live Class
                      </strong>
                      <small>{scheduleLabel}</small>
                    </div>

                    <span className="bdp-experience-arrow" aria-hidden="true">→</span>

                    <div className="bdp-experience-step bdp-experience-after">
                      <span className="bdp-experience-kicker">
                        03 <em className="bdp-free-pill">INCLUDED</em>
                      </span>
                      <strong className="bdp-experience-name">
                        Memory Retest
                      </strong>
                      <small>Compare before and after</small>
                    </div>

                  </div>

                  <p className="bdp-experience-note">
                    See your child's scores before and after the class.
                  </p>

                </div>

              </div>
            </section>

            {/* B2 - PROBLEM: the parent's daily reality */}

            <section
              className="bdp-section bdp-problem"
              aria-labelledby="bdp-problem-title"
            >
              <div className="bdp-wrap">

                <h2 className="bdp-center" id="bdp-problem-title">
                  Does This Sound Familiar?
                </h2>

                <div className="bdp-pain-cards bdp-pain-grid">
                  {PAINS.map((pain) => (
                    <article className="bdp-pain" key={pain.title}>
                      <span className="bdp-icon" aria-hidden="true">{pain.icon}</span>
                      <h3>
                        {pain.title}<br />
                        <span className="bdp-pain-detail">{pain.detail}</span>
                      </h3>
                    </article>
                  ))}
                </div>

                <div className="bdp-relief">
                  <p className="bdp-relief-big">
                    Your child isn't lazy, and isn't weak in studies.
                  </p>
                  <p>
                    Nobody ever taught them <strong>how memory works</strong>.
                    That can be learned, and you can see the difference in a score.
                  </p>
                </div>

              </div>
            </section>

            {/* B2.5 - WHY THEY FORGET: a reason, not just a claim */}

            <section
              className="bdp-section bdp-why"
              aria-labelledby="bdp-why-title"
            >
              <div className="bdp-wrap bdp-narrow">
                <p className="bdp-eyebrow bdp-center">WHY CHILDREN FORGET</p>
                <h2 className="bdp-center" id="bdp-why-title">
                  Reading Again and Again Isn't Enough
                </h2>

                <ol className="bdp-why-list">
                  {WHY_POINTS.map((point, index) => (
                    <li key={point.title}>
                      <span className="bdp-why-num" aria-hidden="true">{index + 1}</span>
                      <div>
                        <strong>{point.title}</strong>
                        <p>{point.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* B3 - FREE MEMORY TEST SELECTOR */}

            <section
              className="bdp-section bdp-assessment"
              id="choose-grade"
              aria-labelledby="bdp-assessment-title"
            >
              <div className="bdp-wrap bdp-assessment-wrap">

                <div className="bdp-section-heading">
                  <p className="bdp-eyebrow">
                    STEP 1 · FREE
                  </p>

                  <h2 id="bdp-assessment-title">
                    Find Your Child's Memory Score
                  </h2>

                  <p>Sit with your child and pick their class to begin.</p>
                </div>

                <div className="bdp-picker">
                  <div
                    className="bdp-grade-grid bdp-group-grid"
                    role="group"
                    aria-label="Choose your child's class"
                  >
                    {GRADES.map((item) => {
                      const chosen = grade === item.grade;

                      return (
                        <button
                          type="button"
                          key={item.grade}
                          className={
                            `bdp-grade bdp-group ${
                              item.track === "advanced"
                                ? "bdp-grade-advanced"
                                : ""
                            } ${chosen ? "bdp-grade-selected" : ""}`
                          }
                          aria-pressed={chosen}
                          onClick={() => setGrade(item.grade)}
                        >
                          <span className="bdp-group-label">
                            {item.label}
                            {chosen && (
                              <span className="bdp-tick" aria-hidden="true"> ✓</span>
                            )}
                          </span>
                          <small className="bdp-group-sub">{item.sub}</small>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    className="bdp-test-button"
                    disabled={!activeGrade}
                    onClick={goToTest}
                  >
                    {activeGrade
                      ? "Start the Free Memory Test →"
                      : "Choose a Class Above"}
                  </button>

                  <p className="bdp-picker-note">
                    Free · 5 memory activities · Instant score out of 100
                  </p>
                </div>

                <p className="bdp-assessment-disclaimer">
                  Each group has its own challenge and matching retest.
                  Scores measure specific memory activities, not
                  intelligence. We don't promise marks. Results vary and
                  improvement is not guaranteed.
                </p>

              </div>
            </section>

            {/* B4 - TRAINER CREDIBILITY */}

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
                  <p className="bdp-eyebrow">MEET YOUR CHILD'S TRAINER</p>

                  <h2 id="bdp-trainer-title">
                    Learn from a Guinness World Record Holder
                  </h2>

                  <h3>Aravind Pasupathy</h3>

                  <p>
                    Memory Trainer since 2011 · Founder, BrainoDad
                  </p>

                  <ul className="bdp-trainer-facts">
                    <li>
                      <strong>Guinness World Record, 2015:</strong> 270 binary
                      digits memorised in one minute
                    </li>
                    <li>
                      <strong>35,000+ students</strong> trained in memory techniques
                    </li>
                  </ul>

                  <blockquote>
                    The memory methods behind the record, made simple for
                    school lessons and practised live in class. This class
                    is about your child, not about showing off a record.
                  </blockquote>
                </div>

              </div>
            </section>

            {/* B5 - VIDEO */}

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
                  A short preview from Aravind. Watching is optional.
                </p>

              </div>
            </section>

            {/* B6 - PARENT FEEDBACK */}

            <section
              className="bdp-section bdp-feedback"
              aria-labelledby="bdp-feedback-heading"
            >
              <div className="bdp-wrap bdp-narrow bdp-center">

                <p className="bdp-eyebrow">
                  REAL PARENT FEEDBACK
                </p>

                <h2 id="bdp-feedback-heading">
                  Hear It From a Parent
                </h2>

                <p className="bdp-feedback-lead">
                  Hemalatha, parent of a Class 12 student, shares her
                  experience of our memory training.
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
                      <strong>Watch Parent Feedback</strong>
                    </button>
                  )}

                </div>

                <p className="bdp-feedback-caption">
                  Real, unscripted video feedback. No claims of guaranteed results.
                </p>

              </div>
            </section>

            {/* B7 - WHAT THEY PRACTISE */}

            <section
              className="bdp-section bdp-benefits"
              aria-labelledby="bdp-benefits-title"
            >
              <div className="bdp-wrap">
                <h2 className="bdp-center" id="bdp-benefits-title">
                  What Your Child Practises in the Live Class
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

            {/* B8 - OFFER: the one place the ₹99 button leads */}

            <section
              className="bdp-section bdp-offer"
              id="booking"
              ref={setOfferEl}
              aria-labelledby="bdp-offer-title"
            >
              <div className="bdp-wrap bdp-offer-wrap">

                <p className="bdp-eyebrow">
                  LIVE STUDY MEMORY MASTERCLASS
                </p>

                <h2 id="bdp-offer-title">
                  Everything Your Child Gets for ₹99
                </h2>

                <div className="bdp-offer-panel">
                  <ul>
                    <li>Free starting memory score (Test 1)</li>
                    <li>2-hour live class with Aravind Pasupathy</li>
                    <li>Practical memory techniques, practised live</li>
                    <li>Second memory test after the class</li>
                    <li>Before-and-after score comparison</li>
                  </ul>

                  <div className="bdp-offer-summary">
                    <span>
                      {scheduleLabel}
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

            {/* B9 - FAQ */}

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
                  <h2>Your Child Studies Hard. Help Them Remember It.</h2>

                  <p>
                    {scheduleLabel} · Live Online
                  </p>

                  {booking()}

                  <button
                    type="button"
                    className="bdp-book-link bdp-final-alt"
                    onClick={scrollToTest}
                  >
                    Or start with the free memory test →
                  </button>
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

            {!dialogOpen && !offerInView && (
              <div className="bdp-sticky">
                {freeTest("bdp-buy-sticky")}
              </div>
            )}

            {(!event || error || !expectedEvent) && (
              <div className="bdp-event-status" role="status">
                <strong>
                  {event && !expectedEvent
                    ? "Booking paused: schedule needs confirmation"
                    : error
                    ? "Booking details unavailable"
                    : "Checking class schedule…"}
                </strong>

                <span>
                  {event && !expectedEvent
                    ? "Please wait for the next approved live class schedule. Booking is unavailable for an expired or invalid schedule."
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
