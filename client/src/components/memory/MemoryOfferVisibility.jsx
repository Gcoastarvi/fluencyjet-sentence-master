import { memoryConsentGranted } from "../../lib/memoryMetaConsent";
import { useEffect, useRef } from "react";
import { trackEvent } from "../../lib/tracking";

// Observe the compact priced CTA, not the entire (potentially very tall) offer.
// A visit is one mounted offer; scrolling/replays do not reset it, reloads do.
export default function MemoryOfferVisibility({ children, blocked, ready, track, source, placement, visit }) {
  const target = useRef(null);
  const ownVisit = useRef(false);
  const reported = visit || ownVisit;

  useEffect(() => {
    if (!ready || blocked || reported.current || !window.IntersectionObserver) return;
    let timer;
    let visible = false;
    function check() {
      clearTimeout(timer);
      if (!visible || document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        const node = target.current;
        if (!node || reported.current || document.visibilityState !== "visible" || !memoryConsentGranted()) return;
        const box = node.getBoundingClientRect();
        const hit = document.elementFromPoint(
          box.left + box.width / 2,
          Math.max(0, box.top) + (Math.min(innerHeight, box.bottom) - Math.max(0, box.top)) / 2,
        );
        if (!hit || !node.contains(hit)) return;
        reported.current = true;
        trackEvent("memory_offer_view", {
          funnel: "amaze_memory", source, track,
          segment: track === "advanced" ? "advanced" : "school",
          placement, page_path: window.location.pathname, price: 99,
        });
      }, 300);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
      check();
    }, { threshold: [0, 0.5] });
    observer.observe(target.current);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("memory-meta-consent", check);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("memory-meta-consent", check);
    };
  }, [blocked, ready, track, source, placement, reported]);

  return <div ref={target} data-memory-offer-visibility={placement}>{children}</div>;
}

