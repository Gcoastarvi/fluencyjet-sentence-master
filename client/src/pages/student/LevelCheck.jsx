// client/src/pages/student/LevelCheck.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getToken } from "@/utils/tokenStore";
import { api } from "@/api/apiClient";

import confetti from "canvas-confetti";
import SentenceBuilder from "@/components/quiz/SentenceBuilder";
import { lessonPathForTrack, normalizeTrack } from "../../lib/trackRoutes";

import {
  trackLevelCheckStart,
  trackLevelCheckComplete,
} from "../../lib/tracking";

const TRACK_KEY = "fj_track";

const TRACK_METADATA = {
  beginner: {
    resultTitle: "Beginner",
    title: "Solid Foundations",
    titleTa: "வலுவான அடித்தளம்",
    description:
      "Great start! You need more practice with basic sentence patterns, word order, questions, and daily English sentences. We’ll help you build confidence step by step.",
    descriptionTa:
      "அருமையான தொடக்கம்! Basic sentence patterns, word order, questions, daily English sentences-ல் இன்னும் practice தேவை. நாங்கள் உங்களை படிப்படியாக confidence உடன் பேச உதவுவோம்.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    cta: "Start Beginner Lessons",
  },

  intermediate: {
    resultTitle: "Intermediate",
    title: "Natural Flow",
    titleTa: "இயல்பான பேச்சு ஓட்டம்",
    description:
      "Great! You already understand many sentence patterns. Now let’s make your English faster, clearer, and more natural.",
    descriptionTa:
      "அருமை! உங்களுக்கு பல sentence patterns புரிகிறது. இனி உங்கள் English-ஐ வேகமாகவும், தெளிவாகவும், இயல்பாகவும் மாற்றலாம்.",
    color: "text-violet-600",
    bg: "bg-violet-50",
    cta: "Start Intermediate Lessons",
  },

  advanced: {
    resultTitle: "Advanced",
    title: "Fluent Mastery",
    titleTa: "சரளமான ஆங்கில திறன்",
    description:
      "Excellent! Your English structure is strong. We’ll now help you speak with more confidence, natural expressions, and professional fluency.",
    descriptionTa:
      "மிகவும் சிறப்பு! உங்கள் English structure வலுவாக உள்ளது. இனி அதிக confidence, natural expressions, professional fluency உடன் பேச உதவுவோம்.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    cta: "Start Advanced Practice",
  },
};


const LEVEL_CHECK_SEGMENTS = {
  work: {
    key: "work",
    headline: "Find Your Workplace English Speaking Level",
    subheadline:
      "For Tamil speakers who understand English but struggle to speak clearly in meetings, calls, office discussions, and professional conversations.",
    cta: "Check My Workplace English Level",
    defaultGoal: "Speak at work",
    badge: "Workplace English Diagnosis",
    whoFor:
      "For working professionals who want to speak better in meetings, calls, and office discussions.",
    resultLabelPrefix: "Your workplace speaking level is",
    resultDiagnosis:
      "Your main challenge may be sentence formation speed in meetings, calls, and office conversations.",
  },
  interview: {
    key: "interview",
    headline: "Find Your Interview English Confidence Level",
    subheadline:
      "Check how ready you are to answer self-introduction, strengths, experience, and basic interview questions in English.",
    cta: "Check My Interview English Level",
    defaultGoal: "Clear interview",
    badge: "Interview English Diagnosis",
    whoFor:
      "For job seekers and freshers who want to answer interviews confidently.",
    resultLabelPrefix: "Your interview English level is",
    resultDiagnosis:
      "You need to practise self-introduction, answer patterns, and confidence-building sentence structures.",
  },
  business: {
    key: "business",
    headline: "Find Your Business English Confidence Level",
    subheadline:
      "For business owners who want to speak more confidently with customers, clients, staff, suppliers, and business contacts.",
    cta: "Check My Business English Level",
    defaultGoal: "Speak with customers",
    badge: "Business English Diagnosis",
    whoFor:
      "For business owners who speak with customers, clients, staff, suppliers, and business contacts.",
    resultLabelPrefix: "Your business English confidence level is",
    resultDiagnosis:
      "You need simple sentence patterns for customers, clients, and business conversations.",
  },
  students: {
    key: "students",
    headline: "Find Your English Speaking Level for Studies and Career",
    subheadline:
      "For students and freshers who want to speak English confidently in class, interviews, presentations, and future job situations.",
    cta: "Check My Student English Level",
    defaultGoal: "Improve confidence",
    badge: "Student English Diagnosis",
    whoFor:
      "For students and freshers who want confidence for class, presentations, interviews, and career.",
    resultLabelPrefix: "Your student/career English level is",
    resultDiagnosis:
      "You need sentence patterns for presentations, interviews, and classroom confidence.",
  },
  daily: {
    key: "daily",
    headline: "Find Your Daily English Speaking Level",
    subheadline:
      "For Tamil speakers who want to speak simple English confidently in daily life, travel, family, shopping, phone calls, and social situations.",
    cta: "Check My Daily English Level",
    defaultGoal: "Daily conversation",
    badge: "Daily English Diagnosis",
    whoFor:
      "For general learners who want to speak simple English in daily life.",
    resultLabelPrefix: "Your daily English speaking level is",
    resultDiagnosis:
      "You need simple sentence patterns for daily conversations, shopping, travel, phone calls, and social situations.",
  },
  general: {
    key: "general",
    headline: "Find Your English Speaking Level",
    subheadline:
      "For Tamil speakers who know English words but struggle to speak confidently.",
    cta: "Find My English Level",
    defaultGoal: "Build sentences faster",
    badge: "English Level Diagnosis",
    whoFor:
      "For Tamil speakers who want to build English sentences faster.",
    resultLabelPrefix: "Your English speaking level is",
    resultDiagnosis:
      "You need simple sentence-making practice to speak English with more confidence.",
  },
};

function getSegmentConfig(search) {
  const params = new URLSearchParams(search || "");
  const key = params.get("segment");
  return LEVEL_CHECK_SEGMENTS[key] || LEVEL_CHECK_SEGMENTS.general;
}

function appendLevelCheckParams(url, data = {}) {
  try {
    const finalUrl = new URL(url, window.location.origin);

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        finalUrl.searchParams.set(key, String(value));
      }
    });

    const currentParams = new URLSearchParams(window.location.search);
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "source",
      "campaign",
      "adset",
      "ad",
    ].forEach((key) => {
      const value = currentParams.get(key);
      if (value && !finalUrl.searchParams.get(key)) {
        finalUrl.searchParams.set(key, value);
      }
    });

    return finalUrl.pathname + finalUrl.search;
  } catch {
    return url;
  }
}

const COMMON_LEVEL_CHECK_QUESTIONS = [
  {
    id: 1,
    level: "beginner",
    skill: "Simple Present",
    q: "Choose the correct sentence:",
    qTa: "சரியான ஆங்கில வாக்கியத்தை தேர்வு செய்யுங்கள்:",
    options: [
      "He go to school.",
      "He goes to school.",
      "He going to school.",
      "He is go to school.",
    ],
    answer: 1,
    wrongMessage:
      "Don’t worry. This helps us choose the right lessons for you.",
    wrongMessageTa:
      "கவலைப்பட வேண்டாம். உங்களுக்கு சரியான பாடங்களை தேர்வு செய்ய இது உதவும்.",
  },
  {
    id: 2,
    level: "beginner",
    skill: "Word Order",
    q: "Choose the correct word order:",
    qTa: "சரியான word order-ஐ தேர்வு செய்யுங்கள்:",
    options: [
      "Coffee I want.",
      "I coffee want.",
      "I want coffee.",
      "Want coffee I.",
    ],
    answer: 2,
    wrongMessage: "Good attempt. We’ll help you build correct sentence order.",
    wrongMessageTa:
      "நல்ல முயற்சி. சரியான sentence order அமைக்க நாங்கள் உதவுவோம்.",
  },
  {
    id: 3,
    level: "beginner",
    skill: "Be Verb",
    q: "Fill in the blank: I ___ a teacher.",
    qTa: "காலியிடத்தை நிரப்புங்கள்: I ___ a teacher.",
    options: ["is", "are", "am", "be"],
    answer: 2,
    wrongMessage: "No problem. Small grammar gaps can be fixed with practice.",
    wrongMessageTa:
      "பரவாயில்லை. சிறிய grammar gaps-ஐ practice மூலம் சரிசெய்யலாம்.",
  },
  {
    id: 4,
    level: "beginner",
    skill: "Questions",
    q: "Choose the correct question:",
    qTa: "சரியான கேள்வி வாக்கியத்தை தேர்வு செய்யுங்கள்:",
    options: [
      "Where you are going?",
      "Where are you going?",
      "Where you going?",
      "Where are going you?",
    ],
    answer: 1,
    wrongMessage:
      "Don’t worry. Question patterns become easy with daily drills.",
    wrongMessageTa:
      "கவலைப்பட வேண்டாம். Daily drills மூலம் question patterns எளிதாகிவிடும்.",
  },
  {
    id: 5,
    level: "beginner",
    skill: "Negative Sentences",
    q: "Pick the correct option: She ___ like tea.",
    qTa: "சரியான option-ஐ தேர்வு செய்யுங்கள்: She ___ like tea.",
    options: ["don't", "doesn't", "isn't", "aren't"],
    answer: 1,
    wrongMessage: "Good try. We’ll help you master negatives clearly.",
    wrongMessageTa:
      "நல்ல முயற்சி. Negative sentences-ஐ தெளிவாக கற்றுக்கொள்ள உதவுவோம்.",
  },
  {
    id: 6,
    level: "intermediate",
    skill: "Past Tense",
    q: "Choose the correct sentence:",
    qTa: "சரியான ஆங்கில வாக்கியத்தை தேர்வு செய்யுங்கள்:",
    options: [
      "I have seen him yesterday.",
      "I saw him yesterday.",
      "I have saw him yesterday.",
      "I seen him yesterday.",
    ],
    answer: 1,
    wrongMessage:
      "No issue. Past tense accuracy improves quickly with practice.",
    wrongMessageTa:
      "பிரச்சனை இல்லை. Practice மூலம் past tense accuracy வேகமாக மேம்படும்.",
  },
  {
    id: 7,
    level: "intermediate",
    skill: "Duration",
    q: "Choose the correct sentence:",
    qTa: "சரியான ஆங்கில வாக்கியத்தை தேர்வு செய்யுங்கள்:",
    options: [
      "She has been working here since 2 years.",
      "She is working here since 2 years.",
      "She has been working here for 2 years.",
      "She works here since 2 years.",
    ],
    answer: 2,
    wrongMessage:
      "Don’t worry. These are common mistakes, and we can fix them.",
    wrongMessageTa:
      "கவலைப்பட வேண்டாம். இவை common mistakes. இதை நிச்சயம் சரிசெய்யலாம்.",
  },
  {
    id: 8,
    level: "intermediate",
    skill: "Natural English",
    q: "Choose the most natural sentence:",
    qTa: "மிகவும் இயல்பான English sentence-ஐ தேர்வு செய்யுங்கள்:",
    options: [
      "Can you suggest me a book?",
      "Can you suggest a book to me?",
      "Can you suggesting a book?",
      "Can you suggest one book for me?",
    ],
    answer: 1,
    wrongMessage: "No problem. FluencyJet will help you sound more natural.",
    wrongMessageTa:
      "பிரச்சனை இல்லை. FluencyJet உங்கள் English-ஐ இன்னும் natural-ஆக மாற்றும்.",
  },
];

const SEGMENT_LEVEL_CHECK_QUESTIONS = {
  work: [
    {
      id: 9,
      level: "beginner",
      skill: "Workplace English",
      q: "Your manager asks for an update. Which sentence is best?",
      qTa: "உங்கள் manager update கேட்கிறார். சிறந்த sentence எது?",
      options: [
        "I am working on it, and I will update you by evening.",
        "I working it and evening update.",
        "I am work on that yesterday.",
        "I will updated you.",
      ],
      answer: 0,
      wrongMessage:
        "Good try. We’ll help you speak clearly in workplace situations.",
      wrongMessageTa:
        "நல்ல முயற்சி. Workplace situations-ல் தெளிவாக பேச நாங்கள் உதவுவோம்.",
    },
    {
      id: 10,
      level: "intermediate",
      skill: "Workplace English",
      q: "You don’t understand something in a meeting. What do you say?",
      qTa: "Meeting-ல் ஏதாவது புரியவில்லை. நீங்கள் என்ன சொல்வீர்கள்?",
      options: [
        "Could you please explain that again?",
        "You explain again now.",
        "I don’t understanded.",
        "Tell again one more.",
      ],
      answer: 0,
      wrongMessage:
        "No problem. Polite workplace English becomes easy with practice.",
      wrongMessageTa:
        "பரவாயில்லை. Practice மூலம் polite workplace English எளிதாகிவிடும்.",
    },
  ],

  interview: [
    {
      id: 9,
      level: "beginner",
      skill: "Interview English",
      q: "The interviewer says, “Tell me about yourself.” Which answer starts naturally?",
      qTa: "Interviewer, “Tell me about yourself” என்று கேட்கிறார். இயல்பான தொடக்கம் எது?",
      options: [
        "My name is Arun, and I recently completed my degree in commerce.",
        "Myself Arun, I am completed degree.",
        "I am Arun and I am study completed.",
        "My good name is Arun.",
      ],
      answer: 0,
      wrongMessage:
        "Good attempt. We’ll help you build strong interview answer patterns.",
      wrongMessageTa:
        "நல்ல முயற்சி. Interview answer patterns-ஐ நாங்கள் வலுப்படுத்த உதவுவோம்.",
    },
    {
      id: 10,
      level: "intermediate",
      skill: "Interview English",
      q: "You want to talk about your strength. Which sentence is correct?",
      qTa: "உங்கள் strength பற்றி சொல்ல வேண்டும். சரியான sentence எது?",
      options: [
        "My strength is that I learn quickly.",
        "My strength are I learning quickly.",
        "I am strength is learn quickly.",
        "I quickly learning is strength.",
      ],
      answer: 0,
      wrongMessage:
        "No issue. Interview confidence improves with repeated sentence practice.",
      wrongMessageTa:
        "பிரச்சனை இல்லை. Repeated sentence practice மூலம் interview confidence மேம்படும்.",
    },
  ],

  business: [
    {
      id: 9,
      level: "beginner",
      skill: "Business English",
      q: "A customer asks about your service. Which sentence is best?",
      qTa: "ஒரு customer உங்கள் service பற்றி கேட்கிறார். சிறந்த sentence எது?",
      options: [
        "Let me explain how our service works.",
        "I explain service working.",
        "My service is explaining.",
        "You listen service.",
      ],
      answer: 0,
      wrongMessage:
        "Good try. We’ll help you speak better with customers and clients.",
      wrongMessageTa:
        "நல்ல முயற்சி. Customers மற்றும் clients உடன் சிறப்பாக பேச உதவுவோம்.",
    },
    {
      id: 10,
      level: "intermediate",
      skill: "Business English",
      q: "You want to ask the customer’s requirement. What do you say?",
      qTa: "Customer requirement-ஐ கேட்க வேண்டும். நீங்கள் என்ன சொல்வீர்கள்?",
      options: [
        "Could you please share your requirement?",
        "You tell requirement fast.",
        "What you want means?",
        "Requirement you saying?",
      ],
      answer: 0,
      wrongMessage:
        "No problem. Customer communication becomes natural with practice.",
      wrongMessageTa:
        "பரவாயில்லை. Practice மூலம் customer communication இயல்பாகிவிடும்.",
    },
  ],

  students: [
    {
      id: 9,
      level: "beginner",
      skill: "Student English",
      q: "You are giving a presentation. Which sentence is best?",
      qTa: "நீங்கள் presentation கொடுக்கிறீர்கள். சிறந்த sentence எது?",
      options: [
        "Today, I am going to talk about my project.",
        "Today I talking about my project.",
        "I am talk my project today.",
        "My project talking today.",
      ],
      answer: 0,
      wrongMessage:
        "Good attempt. We’ll help you speak confidently in presentations.",
      wrongMessageTa:
        "நல்ல முயற்சி. Presentations-ல் confidence உடன் பேச உதவுவோம்.",
    },
    {
      id: 10,
      level: "intermediate",
      skill: "Student English",
      q: "You want to ask a teacher a question. What do you say?",
      qTa: "Teacher-ிடம் ஒரு question கேட்க வேண்டும். நீங்கள் என்ன சொல்வீர்கள்?",
      options: [
        "Could you please explain this once again?",
        "Explain again one time you.",
        "I am not understanded.",
        "You telling again.",
      ],
      answer: 0,
      wrongMessage:
        "No issue. We’ll help you ask questions politely and clearly.",
      wrongMessageTa:
        "பிரச்சனை இல்லை. கேள்விகளை polite-ஆவும் clear-ஆவும் கேட்க உதவுவோம்.",
    },
  ],

  daily: [
    {
      id: 9,
      level: "beginner",
      skill: "Daily English",
      q: "You are ordering food. Which sentence is correct?",
      qTa: "நீங்கள் food order செய்கிறீர்கள். சரியான sentence எது?",
      options: [
        "I would like to order one coffee.",
        "I want ordering one coffee.",
        "One coffee I am order.",
        "I ordered now coffee.",
      ],
      answer: 0,
      wrongMessage:
        "Good try. We’ll help you speak simple English in daily situations.",
      wrongMessageTa:
        "நல்ல முயற்சி. Daily situations-ல் simple English பேச உதவுவோம்.",
    },
    {
      id: 10,
      level: "intermediate",
      skill: "Daily English",
      q: "You need help in a shop. What do you say?",
      qTa: "Shop-ல் உங்களுக்கு help வேண்டும். நீங்கள் என்ன சொல்வீர்கள்?",
      options: [
        "Could you please help me find this item?",
        "You help finding item.",
        "I need this finding.",
        "Item help me.",
      ],
      answer: 0,
      wrongMessage:
        "No problem. Daily English becomes easy with situation-based practice.",
      wrongMessageTa:
        "பரவாயில்லை. Situation-based practice மூலம் daily English எளிதாகிவிடும்.",
    },
  ],

  general: [
    {
      id: 9,
      level: "beginner",
      skill: "Speaking Basics",
      q: "You want to say you are learning English now. Which sentence is correct?",
      qTa: "நீங்கள் இப்போது English கற்றுக்கொள்கிறீர்கள் என்று சொல்ல வேண்டும். சரியான sentence எது?",
      options: [
        "I am learning English every day.",
        "I learning English every day.",
        "I am learn English daily.",
        "English learning I am daily.",
      ],
      answer: 0,
      wrongMessage:
        "Good attempt. We’ll help you build correct English sentences.",
      wrongMessageTa:
        "நல்ல முயற்சி. சரியான English sentences உருவாக்க உதவுவோம்.",
    },
    {
      id: 10,
      level: "intermediate",
      skill: "Speaking Basics",
      q: "You want to ask someone to speak slowly. What do you say?",
      qTa: "யாரையாவது மெதுவாக பேச சொல்ல வேண்டும். நீங்கள் என்ன சொல்வீர்கள்?",
      options: [
        "Could you please speak slowly?",
        "You speak slow now.",
        "Slowly you are speaking.",
        "Speak slow means.",
      ],
      answer: 0,
      wrongMessage:
        "No issue. We’ll help you speak and respond naturally.",
      wrongMessageTa:
        "பிரச்சனை இல்லை. இயல்பாக பேசவும் பதில் சொல்லவும் உதவுவோம்.",
    },
  ],
};



function getPremiumHeroCopy(segment) {
  const key = segment?.key || "general";

  const map = {
    work: {
      badge: "Workplace English Diagnosis",
      highlight: "Workplace English Confidence Level",
      banner: "For working professionals who want to communicate better in meetings, calls, and office discussions.",
      cta: "Start My Free Workplace Check",
      quote:
        "I’ll help you check how ready you are for meetings, calls, and workplace conversations. It’s just 10 quick questions.",
      icon: "🏢",
    },
    interview: {
      badge: "Interview English Diagnosis",
      highlight: "Interview English Confidence Level",
      banner: "For job seekers and freshers who want to answer interviews confidently.",
      cta: "Start My Free Interview Check",
      quote:
        "I’ll help you find the right English practice path for interviews. It’s just 10 quick questions.",
      icon: "💼",
    },
    business: {
      badge: "Business English Diagnosis",
      highlight: "Business English Confidence Level",
      banner: "For business owners who want to speak confidently with customers, clients, staff, and suppliers.",
      cta: "Start My Free Business English Check",
      quote:
        "I’ll help you discover your business English confidence level in just 10 quick questions.",
      icon: "🤝",
    },
    students: {
      badge: "Study & Career English Diagnosis",
      highlight: "Study & Career English Confidence Level",
      banner: "For students and freshers who want confidence for studies, presentations, interviews, and career.",
      cta: "Start My Free Student English Check",
      quote:
        "I’ll help you find the right English path for your studies and career. It’s just 10 quick questions.",
      icon: "🎓",
    },
    daily: {
      badge: "Daily English Fluency Diagnosis",
      highlight: "Daily Conversation Fluency Level",
      banner: "For Tamil speakers who want to speak confidently in daily life, travel, shopping, phone calls, and social situations.",
      cta: "Start My Free Daily English Check",
      quote:
        "I’ll help you discover your daily conversation level in just 10 quick questions.",
      icon: "💬",
    },
    general: {
      badge: "English Level Diagnosis",
      highlight: "English Speaking Confidence Level",
      banner: "For Tamil speakers who know English words but struggle to speak confidently.",
      cta: "Start My Free Level Check",
      quote:
        "I’ll help you find the right English practice path for you. It’s just 10 quick questions.",
      icon: "🚀",
    },
  };

  return map[key] || map.general;
}

function PremiumLevelCheckIntro({ segment, onStart }) {
  const hero = getPremiumHeroCopy(segment);

  return (
    <div className="-mx-6 -my-6 overflow-hidden rounded-3xl bg-white">
      <div className="bg-violet-950 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4 text-sm font-bold sm:gap-7">
          <span className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span> Free 2-Minute Level Check
          </span>
          <span className="hidden text-violet-300 sm:inline">|</span>
          <span className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span> Instant Result
          </span>
          <span className="hidden text-violet-300 sm:inline">|</span>
          <span className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span> No Signup Required to Check
          </span>
        </div>
      </div>

      <section className="bg-gradient-to-br from-white via-violet-50 to-violet-100 px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-violet-100 backdrop-blur">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src="/coach.jpg"
                    alt="Coach Aravind"
                    className="h-20 w-20 rounded-full border-4 border-violet-200 object-cover shadow-md"
                    onError={(e) => {
                      e.currentTarget.src = "/avatar-fallback.png";
                    }}
                  />
                  <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-xs font-black text-white">
                    ✓
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-black text-slate-950">Aravind</h3>
                  <p className="mt-1 text-sm font-bold text-violet-700">
                    English Coach & Memory Trainer
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-violet-100 bg-white p-5 shadow-md">
                <p className="text-base font-semibold leading-relaxed text-slate-700">
                  “{hero.quote.replace("10 quick questions", "")}
                  <span className="font-black text-violet-700">
                    10 quick questions
                  </span>
                  .”
                </p>
                <p className="mt-3 text-sm font-bold leading-relaxed text-violet-700">
                  உங்களுக்கு சரியான English practice path-ஐ கண்டுபிடிக்க உதவுகிறேன்.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="text-2xl">⭐</div>
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    Guinness Record
                  </p>
                  <p className="text-base font-black text-slate-900">Holder</p>
                </div>
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <div className="text-2xl">👥</div>
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    Students
                  </p>
                  <p className="text-base font-black text-slate-900">35,000+</p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-black text-slate-600">
                  <span className="text-violet-600">◷</span> Just 2 minutes
                </div>
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-200" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-100 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-violet-600" />
              <span className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
                {hero.badge}
              </span>
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.03] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Find Your
              <span className="block bg-gradient-to-r from-violet-600 to-violet-800 bg-clip-text text-transparent">
                {hero.highlight}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg font-semibold leading-relaxed text-slate-600 sm:text-xl">
              {segment.subheadline}
            </p>

            <div className="mt-6 max-w-2xl rounded-3xl border-l-4 border-violet-600 bg-white/70 p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-2xl">
                  {hero.icon}
                </div>
                <p className="text-base font-black leading-relaxed text-violet-800">
                  {hero.banner}
                </p>
              </div>
            </div>

            <p className="mt-6 flex items-center gap-2 text-sm font-bold text-slate-500">
              <span className="text-emerald-500">●</span>
              Takes only 2 minutes • No signup required to check
            </p>

            <button
              type="button"
              onClick={onStart}
              className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-violet-600 to-violet-800 px-8 py-5 text-lg font-black text-white shadow-2xl shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-violet-300 active:scale-[0.98] sm:w-auto sm:text-xl"
            >
              {hero.cta}
              <span className="text-2xl">→</span>
            </button>

            <div className="mt-8 grid max-w-2xl grid-cols-3 items-start gap-3 text-center">
              {[
                ["1", "Take Quiz", "2 mins"],
                ["2", "Get Result", "Instant"],
                ["3", "Start Free", "Practice"],
              ].map(([num, title, sub], index) => (
                <div key={num} className="relative">
                  {index < 2 && (
                    <div className="absolute left-[62%] top-6 hidden h-1 w-[75%] rounded-full bg-gradient-to-r from-violet-600 to-violet-300 sm:block" />
                  )}
                  <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet-300 bg-violet-100 text-lg font-black text-violet-700">
                    {num}
                  </div>
                  <p className="mt-2 text-sm font-black text-slate-800">{title}</p>
                  <p className="text-xs font-medium text-slate-500">{sub}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
                ✓ Free app practice path
              </div>
              <div className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
                ✓ Free live class invite
              </div>
              <div className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">
                ✓ Personalized practice path
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              What You Get After the Check
            </h2>
            <p className="mt-3 text-lg font-medium text-slate-600">
              Not just a score. A personalized roadmap to fluency.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["📊", "Instant Level Report", "Know your speaking level immediately."],
              ["🗺️", "Personalized Path", "Get a practice path based on your level and goal."],
              ["📱", "Free App Access", "Start practising with curated sample lessons."],
              ["🎥", "Live Class Invite", "Reserve your free live class seat."],
            ].map(([icon, title, desc]) => (
              <div
                key={title}
                className="rounded-3xl border border-slate-100 bg-gradient-to-br from-violet-50 to-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-3xl shadow-sm">
                  {icon}
                </div>
                <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-violet-600 to-violet-900 px-5 py-8 text-center text-white">
        <p className="text-xl font-black">
          🕒 Your free practice path is ready after the level check
        </p>
        <p className="mt-2 text-sm font-semibold text-violet-100">
          Take the 2-minute check, get your result, and start practising your first sentences.
        </p>
      </section>

      <footer className="bg-slate-950 px-5 py-8 text-center text-sm font-medium text-slate-400">
        <p>FluencyJet — Speak English with Confidence</p>
        <p className="mt-1 text-slate-500">
          Your data is safe. No spam, ever.
        </p>
        <p className="mx-auto mt-4 max-w-3xl text-xs leading-relaxed text-slate-600">
          This site is not a part of the Facebook website or Meta Platforms, Inc.
          Additionally, this site is NOT endorsed by Facebook or Meta in any way.
          FACEBOOK is a trademark of Meta Platforms, Inc.
        </p>
      </footer>
    </div>
  );
}


export default function LevelCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const segment = useMemo(
    () => getSegmentConfig(location.search),
    [location.search],
  );

  const QUESTIONS = useMemo(() => {
    return [
      ...COMMON_LEVEL_CHECK_QUESTIONS,
      ...(SEGMENT_LEVEL_CHECK_QUESTIONS[segment.key] ||
        SEGMENT_LEVEL_CHECK_QUESTIONS.general),
    ];
  }, [segment.key]);
  const [mode, setMode] = useState("pick"); // "pick" | "quiz" | "result"
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionIndex }
  const [result, setResult] = useState(null); // { score, track }
  const [userName, setUserName] = useState("");
  const [step, setStep] = useState("intro"); // intro, quiz, result

  useEffect(() => {
    trackLevelCheckStart("level_check_page");
  }, []);

  function goToTrack(track, opts = {}) {
    try {
      localStorage.setItem(TRACK_KEY, track);

      const raw = localStorage.getItem("user");
      const u = raw ? JSON.parse(raw) : {};
      localStorage.setItem("user", JSON.stringify({ ...u, track }));
    } catch {}

    const token = getToken();

    const isHighPath = track === "intermediate" || track === "advanced";
    const difficulty = isHighPath ? "intermediate" : "beginner";
    const base = isHighPath ? "/i" : "/b";
    const lessonHubUrl = `${base}/lesson/1?difficulty=${difficulty}`;
    const target = lessonHubUrl;

    if (opts && opts.startLesson1) {
      if (!token) {
        navigate(
          appendLevelCheckParams("/smart-signup", {
              next: lessonHubUrl,
              track,
              segment: segment.key,
              goal: segment.defaultGoal,
              level:
                track === "intermediate" || track === "advanced"
                  ? "Intermediate"
                  : "Beginner",
              score: result?.score,
            }),
          { replace: true },
        );
        return;
      }

      navigate(lessonHubUrl, { replace: true });
      return;
    }

    if (!token) {
      navigate(
        appendLevelCheckParams("/smart-signup", {
            next: target,
            track,
            segment: segment.key,
            goal: segment.defaultGoal,
            level:
              track === "intermediate" || track === "advanced"
                ? "Intermediate"
                : "Beginner",
            score: result?.score,
          }),
        { replace: true },
      );
      return;
    }

    navigate(target, { replace: true });
  }

  const current = QUESTIONS[idx];

  const score = useMemo(() => {
    let s = 0;
    for (const q of QUESTIONS) {
      const a = answers[q.id];
      if (typeof a === "number" && a === q.answer) s += 1;
    }
    return s;
  }, [answers]);

  async function finishQuiz() {
    const finalScore = QUESTIONS.reduce((total, q) => {
      const selected = answers[q.id];
      return total + (selected === q.answer ? 1 : 0);
    }, 0);

    const beginnerCorrect = QUESTIONS.filter(
      (q) => q.level === "beginner",
    ).reduce((total, q) => total + (answers[q.id] === q.answer ? 1 : 0), 0);

    const intermediateCorrect = QUESTIONS.filter(
      (q) => q.level === "intermediate",
    ).reduce((total, q) => total + (answers[q.id] === q.answer ? 1 : 0), 0);

    const track =
      beginnerCorrect >= 4 && intermediateCorrect >= 3
        ? "intermediate"
        : "beginner";

    console.log("[LEVEL CHECK]", { answers, finalScore, track });

    const levelLabel =
        track === "intermediate" || track === "advanced"
          ? "Intermediate"
          : "Beginner";

      const levelResultPayload = {
        score: finalScore,
        track,
        level: levelLabel,
        segment: segment.key,
        main_goal: segment.defaultGoal,
        result_diagnosis: segment.resultDiagnosis,
      };

      setResult(levelResultPayload);

      try {
        sessionStorage.setItem(
          "fj_level_result",
          JSON.stringify(levelResultPayload),
        );
        localStorage.setItem("fj_level_segment", segment.key);
        localStorage.setItem("fj_main_goal", segment.defaultGoal);
      } catch {}

      setMode("result");
    setStep("result");

    try {
      localStorage.setItem("fj_track", track);
    } catch {}

    try {
      const response = await api.post("/quizzes/sync-placement", {
        track: track.toUpperCase(),
      });

      if (response.data?.ok) {
        console.log("[SYNC] Profile successfully updated to:", track);
      }
    } catch (err) {
      console.error("❌ Placement sync failed:", err);
    }

    trackLevelCheckComplete({
      score: finalScore,
      track,
      source: "level_check_page",
    });

    try {
      const levelUpSound = new Audio("/sounds/levelup.mp3");
      levelUpSound.volume = 0.5;
      levelUpSound.play().catch(() => {});
    } catch {}

    try {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#8b5cf6", "#a78bfa", "#c4b5fd"],
      });
    } catch {}
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-white via-slate-50 to-violet-50/40 py-10">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur">
            {mode === "pick" && (
              <PremiumLevelCheckIntro
                segment={segment}
                onStart={() => {
                  setMode("quiz");
                  setStep("quiz");
                }}
              />
            )}

            {/* 290: Refined Quiz Interface */}
          {mode === "quiz" && (
            <div className="max-w-md mx-auto py-8 flex flex-col items-center">
              {/* Top Progress Header */}
              <div className="mb-12">
                <div className="flex justify-between items-end mb-3">
                  <div className="flex flex-col">
                    <div className="text-xs font-bold uppercase tracking-[0.35em] text-violet-500">
                      Finding Your Level
                    </div>

                    <div className="mt-1 text-sm font-medium text-slate-400 font-tamil">
                      உங்கள் English level-ஐ கண்டுபிடிக்கிறோம்
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      Question {idx + 1}{" "}
                      <span className="text-slate-400 font-medium">
                        / {QUESTIONS.length}
                      </span>
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                      Live Analysis
                    </span>
                  </div>
                </div>

                {/* Smooth Progress Bar */}
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-500 ease-out rounded-full"
                    style={{
                      width: `${((idx + 1) / QUESTIONS.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Question Text */}
              {/* Tightened Question Text */}
              <div className="mb-6 text-center">
                <div className="inline-block px-3 py-1 rounded-md bg-violet-50 text-violet-700 text-[10px] font-bold uppercase tracking-widest mb-4">
                  Grammar & Structure
                </div>

                <h3 className="text-2xl font-black text-slate-800 leading-tight px-4">
                  {QUESTIONS[idx].q}
                </h3>

                {QUESTIONS[idx].qTa && (
                  <p className="mt-2 px-4 text-base font-semibold leading-relaxed text-slate-500 font-tamil">
                    {QUESTIONS[idx].qTa}
                  </p>
                )}
              </div>

              {/* Option Grid */}
              <div className="w-full">
                {QUESTIONS[idx].type === "reorder" ? (
                  <SentenceBuilder
                    key={QUESTIONS[idx].id}
                    correctSentence={QUESTIONS[idx].correctAnswer}
                    onCorrect={() => {
                      const audio = new Audio("/sounds/correct.mp3");
                      audio.play().catch(() => {});
                      // Set the answer in state to enable the "Next" button
                      setAnswers((a) => ({ ...a, [QUESTIONS[idx].id]: true }));
                    }}
                    accentColor="violet"
                  />
                ) : (
                  /* Standard Multiple Choice Grid */
                  <div className="grid gap-3 w-full max-w-sm mx-auto">
                    {QUESTIONS[idx].options.map((opt, optIdx) => {
                      const isSelected = answers[QUESTIONS[idx].id] === optIdx;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const clickSound = new Audio("/sounds/correct.mp3");
                            clickSound.volume = 0.4;
                            clickSound.play().catch(() => {});
                            setAnswers((a) => ({
                              ...a,
                              [QUESTIONS[idx].id]: optIdx,
                            }));
                          }}
                          className={`group relative flex items-center gap-4 p-5 text-left rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] ${
                            isSelected
                              ? "border-violet-600 bg-violet-50 shadow-md translate-x-1"
                              : "border-slate-100 bg-white hover:border-violet-200 hover:bg-slate-50/50 hover:-translate-y-0.5"
                          }`}
                        >
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 font-bold transition-all ${
                              isSelected
                                ? "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-200"
                                : "border-slate-100 bg-slate-50 text-slate-400 group-hover:border-violet-200 group-hover:text-violet-600"
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          <span
                            className={`text-lg font-medium ${isSelected ? "text-violet-900" : "text-slate-700"}`}
                          >
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/*
              Friendly Feedback After Selection - temporarily hidden

              {QUESTIONS[idx].type !== "reorder" &&
                answers[QUESTIONS[idx].id] !== undefined &&
                answers[QUESTIONS[idx].id] !== QUESTIONS[idx].answer && (
                  <div className="mt-5 mx-auto max-w-sm rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-center shadow-sm">
                    <p className="text-sm font-semibold text-violet-800">
                      {QUESTIONS[idx].wrongMessage ||
                        "Don’t worry. This helps us choose the right lessons for you."}
                    </p>

                    <p className="mt-1 text-sm font-medium leading-relaxed text-violet-700 font-tamil">
                      {QUESTIONS[idx].wrongMessageTa ||
                        "கவலைப்பட வேண்டாம். உங்களுக்கு சரியான பாடங்களை தேர்வு செய்ய இது உதவும்."}
                    </p>
                  </div>
                )}
              */}

              {/* Compact & Polished Navigation */}
              <div className="mt-8 flex justify-center pt-6 border-t border-slate-100/60">
                {idx < QUESTIONS.length - 1 ? (
                  <button
                    onClick={() => setIdx((i) => i + 1)}
                    disabled={answers[QUESTIONS[idx].id] === undefined}
                    className="group flex items-center gap-3 bg-slate-900 text-white px-10 py-4 rounded-xl font-bold shadow-lg hover:bg-slate-800 disabled:opacity-30 transition-all active:scale-95"
                  >
                    Next Question
                    <svg
                      className="h-5 w-5 transition-transform group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={finishQuiz}
                    disabled={answers[QUESTIONS[idx].id] === undefined}
                    className="bg-violet-600 text-white px-12 py-4 rounded-2xl font-black text-lg shadow-xl shadow-violet-200 hover:bg-violet-700 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Calculate Level
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Shareable Result Card */}
          {mode === "result" && (
            <>
              <div className="py-6 text-center">
                {(() => {
                  const track = normalizeTrack(
                    result?.track || (score >= 5 ? "intermediate" : "beginner"),
                  );

                  const meta = TRACK_METADATA[track] || TRACK_METADATA.beginner;

                  return (
                    <>
                      {/* Badge Header */}
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold uppercase tracking-widest mb-6 border border-emerald-100">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Assessment Verified
                      </div>

                      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">
                        Proficiency Level
                      </h2>

                      <p className="mb-4 text-sm font-semibold text-slate-400 font-tamil">
                        உங்கள் English level கண்டறியப்பட்டது
                      </p>

                      {/* Dynamic Result Visual */}
                      <div className="relative inline-block mb-8">
                        <div className="absolute inset-0 bg-violet-400 blur-3xl opacity-20 animate-pulse" />
                        <div className="relative bg-white border-2 border-violet-100 rounded-3xl px-12 py-8 shadow-2xl shadow-violet-100">
                          <h1 className="text-6xl font-black text-violet-600 capitalize leading-none tracking-tight">
                            {meta.resultTitle || track}
                          </h1>
                        </div>
                      </div>

                      {/* Score Breakdown Tiles */}
                      <div className="max-w-md mx-auto grid grid-cols-2 gap-4 mb-8">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Accuracy
                          </div>
                          <div className="text-xl font-bold text-slate-800">
                            {score >= 7
                              ? "High"
                              : score >= 4
                                ? "Good"
                                : "Building"}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Path
                          </div>
                          <div className="text-xl font-bold text-slate-800 capitalize">
                            {track}
                          </div>
                        </div>
                      </div>

                      {/* Personalized Level Feedback */}
                      <div
                        className={`mb-10 p-6 rounded-3xl border ${meta.bg || "bg-slate-50"} border-opacity-50 inline-block max-w-md mx-auto shadow-sm`}
                      >
                        <h3
                          className={`text-xs font-black uppercase tracking-[0.2em] mb-1 ${meta.color || "text-slate-600"}`}
                        >
                          {meta.title || "Your Result"}
                        </h3>

                        {meta.titleTa && (
                          <p className="mb-3 text-sm font-bold text-slate-500 font-tamil">
                            {meta.titleTa}
                          </p>
                        )}

                        <p className="text-slate-600 text-sm leading-relaxed font-medium">
                          {meta.description ||
                            "Your level assessment is ready."}
                        </p>

                        {meta.descriptionTa && (
                          <p className="mt-3 text-[15px] leading-relaxed text-slate-500 font-tamil">
                            {meta.descriptionTa}
                          </p>
                        )}

                        <div className="mt-5 rounded-2xl bg-white/70 px-4 py-3 text-sm font-bold text-violet-700">
                          Your free FluencyJet account and live class seat are
                          ready to unlock.
                          <div className="mt-1 font-tamil text-slate-600">
                            உங்கள் free account மற்றும் live class seat unlock
                            செய்ய தயாராக உள்ளது.
                          </div>
                        </div>
                      </div>

                      {/* Primary Action */}
                      <div className="flex flex-col gap-4 max-w-sm mx-auto">
                        <button
                          onClick={() => {
                            const next = lessonPathForTrack(track, 1);
                            const encodedNext = encodeURIComponent(next);

                            try {
                              sessionStorage.setItem(
                                "fj_level_result",
                                JSON.stringify({
                                  level: meta.resultTitle || track,
                                  level_check_result: meta.resultTitle || track,
                                  track,
                                  score,
                                  completedAt: new Date().toISOString(),
                                }),
                              );
                              localStorage.setItem("fj_track", track);
                            } catch {}

                            window.location.href = `/smart-signup?next=${encodedNext}&track=${track}&name=${encodeURIComponent(userName || "")}`;
                          }}
                          className="w-full bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <span>Create Free Account + Reserve My Seat</span>
                          <span className="text-xl">→</span>
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Shareable Footer */}
              <div className="mt-16 pt-8 border-t border-slate-100 flex justify-between items-center text-slate-300">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                  Verified by FluencyJet AI
                </div>
                <span className="text-[9px] font-medium uppercase tracking-[0.2em] opacity-60">
                  FJ-ENGINE V1.0
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
