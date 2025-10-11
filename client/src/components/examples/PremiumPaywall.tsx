import { useState } from "react";
import { Button } from "@/components/ui/button";
import PremiumPaywall from "../PremiumPaywall";

export default function PremiumPaywallExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)} data-testid="button-open-paywall">
        Show Premium Paywall
      </Button>
      <PremiumPaywall open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
