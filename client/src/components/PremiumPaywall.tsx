import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Crown } from "lucide-react";

interface PremiumPaywallProps {
  open: boolean;
  onClose: () => void;
}

export default function PremiumPaywall({ open, onClose }: PremiumPaywallProps) {
  const features = [
    "Access to all advanced lessons",
    "Personalized learning paths",
    "Detailed progress analytics",
    "Priority support",
    "Ad-free experience",
    "Downloadable content",
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="premium-paywall">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Crown className="w-6 h-6 text-chart-3" />
            Upgrade to Premium
          </DialogTitle>
          <DialogDescription>
            Unlock all features and accelerate your learning journey
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-chart-2/5">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Premium Features</h3>
              <ul className="space-y-3">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-chart-1 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <div className="space-y-4">
            <p className="text-center text-muted-foreground">
              Contact the administrator to activate your premium account
            </p>
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                console.log("Contact admin clicked");
                onClose();
              }}
              data-testid="button-contact-admin"
            >
              Contact Admin for Activation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
