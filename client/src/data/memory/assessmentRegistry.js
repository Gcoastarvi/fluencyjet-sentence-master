import schoolFoundationFormA from "./schoolFoundationFormA";
import schoolAdvancedFormA from "./schoolAdvancedFormA";

const MEMORY_ASSESSMENTS = {
  school_foundation: {
    trackId: "school_foundation",
    label: "Class 6–8",
    form: "A",
    studentClasses: ["6", "7", "8"],
    config: schoolFoundationFormA,
  },

  school_advanced: {
    trackId: "school_advanced",
    label: "Class 9–12",
    form: "A",
    studentClasses: ["9", "10", "11", "12"],
    config: schoolAdvancedFormA,
  },
};

export function getMemoryAssessment(trackId) {
  return MEMORY_ASSESSMENTS[trackId] || null;
}

export default MEMORY_ASSESSMENTS;
