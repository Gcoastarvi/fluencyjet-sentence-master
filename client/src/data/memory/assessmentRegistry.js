import advancedFormA from "./advancedFormA";
import schoolFoundationFormA from "./schoolFoundationFormA";
import schoolAdvancedFormA from "./schoolAdvancedFormA";

const MEMORY_ASSESSMENTS = {
  school_foundation: {
    trackId: "school_foundation",
    label: "Class 6–8",
    form: "A",
    leadType: "school",
    studentClasses: ["6", "7", "8"],
    config: schoolFoundationFormA,
  },

  school_advanced: {
    trackId: "school_advanced",
    label: "Class 9–12",
    form: "A",
    leadType: "school",
    studentClasses: ["9", "10", "11", "12"],
    config: schoolAdvancedFormA,
  },

  advanced: {
    trackId: "advanced",
    label: "Advanced",
    form: "A",
    leadType: "advanced",

    studyCategories: [
      { value: "NEET", label: "NEET" },
      { value: "JEE", label: "JEE" },
      { value: "CAT", label: "CAT" },
      { value: "UPSC", label: "UPSC" },
      { value: "TNPSC", label: "TNPSC" },
      { value: "BANK_EXAMS", label: "Bank Exams" },
      {
        value: "WORKING_PROFESSIONAL",
        label: "Working Professional",
      },
      { value: "OTHER", label: "Other" },
    ],

    config: advancedFormA,
  },
};

export function getMemoryAssessment(trackId) {
  return MEMORY_ASSESSMENTS[trackId] || null;
}

export default MEMORY_ASSESSMENTS;
