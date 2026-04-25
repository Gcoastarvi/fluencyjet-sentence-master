import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../lib/tracking";

export default function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
