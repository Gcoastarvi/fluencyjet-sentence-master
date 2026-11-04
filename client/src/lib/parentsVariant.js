// A/B test for /memory-masterclass/parents.
//
// Both variants are served on the SAME path on purpose: the backend's Parents
// purchase rule only accepts checkouts from exactly /memory-masterclass/parents,
// and the browser Meta policy only allows utm_* / fbclid query keys there.
// The variant is therefore chosen by the ad link's utm_content value:
//   utm_content=parents_b  -> variant B (free-test-first page)
//   utm_content=parents_a  -> variant A (original page)
//   anything else / none   -> the variant already chosen this session, else A
// The choice is kept for the browser session so in-page navigation and
// back-button returns show the same page.

export const PARENTS_VARIANT_KEY = "bdp_parents_variant";

const FROM_UTM = { parents_a: "a", parents_b: "b" };

export function parentsVariant(search, storage) {
  let fromUtm;
  try {
    const value = new URLSearchParams(search || "").get("utm_content");
    fromUtm = FROM_UTM[String(value || "").trim().toLowerCase()];
  } catch {
    fromUtm = undefined;
  }

  if (fromUtm) {
    try { storage?.setItem(PARENTS_VARIANT_KEY, fromUtm); } catch { /* storage optional */ }
    return fromUtm;
  }

  try {
    const saved = storage?.getItem(PARENTS_VARIANT_KEY);
    if (saved === "a" || saved === "b") return saved;
  } catch { /* storage optional */ }

  return "a";
}
