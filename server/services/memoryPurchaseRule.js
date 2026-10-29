// No legally/platform-approved no-opt-in eligibility rule has been supplied.
// A configuration value, Pay, Parents URL or phone number cannot supply it.
// Replace this denial ONLY with the specifically reviewed server-side rule.
// It must establish adult-owned purchaser data and current refusal/withdrawal,
// child-exclusion and platform eligibility from supportable inputs, not flags
// supplied by the browser. No customer verification workflow is created here.
export const MEMORY_PURCHASE_RULE_VERSION = "UNIMPLEMENTED";
export async function evaluateApprovedMemoryPurchaseRule() {
  return { eligible: false, reason: "APPROVED_RULE_NOT_IMPLEMENTED" };
}
