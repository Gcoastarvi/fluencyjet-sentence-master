import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import MemoryMasterclassParents from "./MemoryMasterclassParents";
import MemoryMasterclassParentsV2 from "./MemoryMasterclassParentsV2";
import { parentsVariant } from "../../lib/parentsVariant";

// Serves both A/B variants on /memory-masterclass/parents (see parentsVariant.js).
// The original page component is reused unchanged as variant A.
export default function MemoryMasterclassParentsAB() {
  const { search } = useLocation();
  const variant = useMemo(() => {
    let storage = null;
    try { storage = window.sessionStorage; } catch { storage = null; }
    return parentsVariant(search, storage);
  }, [search]);

  return variant === "b"
    ? <MemoryMasterclassParentsV2 />
    : <MemoryMasterclassParents />;
}
