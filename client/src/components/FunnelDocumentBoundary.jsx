import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { navigateFreshDocument, ownsFunnelRoute } from "../lib/funnelDocument";

export default function FunnelDocumentBoundary({ children }) {
  const location = useLocation();
  const owned = ownsFunnelRoute(location.pathname);
  useLayoutEffect(() => {
    if (!owned) navigateFreshDocument(location.pathname + location.search + location.hash);
  }, [owned, location.pathname, location.search, location.hash]);
  // History adapters may notify React after intercepted pushState returns.
  // Never mount foreign components/effects, even for a single frame.
  return owned ? children : null;
}
