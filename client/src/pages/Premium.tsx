import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Crown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Premium() {
  const features = [
    { name: "Access to all advanced lessons", free: false, premium: true },
    { name: "Personalized learning paths", free: false, premium: true },
    { name: "Detailed progress analytics", free: false, premium: true },
    { name: "Priority support", free: false, premium: true },
    { name: "Ad-free experience", free: false, premium: true },
    { name: "Downloadable content", free: false, premium: true },
    { name: "Basic lessons", free: true, premium: true },
    { name: "Progress tracking", free: true, premium: true },
    { name: "Daily challenges", free: true, premium: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-chart-2/5">
      <div className="container mx-auto px-4 py-12 space-y-12">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <Badge className="bg-chart-3 text-white">
            <Crown className="w-3 h-3 mr-1" />
            Premium
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold">
            Unlock Your Full Potential
          </h1>
          <p className="text-xl text-muted-foreground">
            Accelerate your English learning journey with premium features
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="text-2xl">Free</CardTitle>
              <p className="text-3xl font-bold font-serif">₹0</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {features.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-3">
                    {feature.free ? (
                      <Check className="w-5 h-5 text-chart-1 flex-shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                    <span className={feature.free ? "" : "text-muted-foreground"}>
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary/50 shadow-lg hover-elevate relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Crown className="w-6 h-6 text-chart-3" />
                Premium
              </CardTitle>
              <p className="text-3xl font-bold font-serif">Contact Admin</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {features.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-chart-1 flex-shrink-0 mt-0.5" />
                    <span>{feature.name}</span>
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className="w-full"
                data-testid="button-contact-admin"
                onClick={() => console.log("Contact admin clicked")}
              >
                Contact Admin for Activation
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="max-w-5xl mx-auto bg-gradient-to-br from-primary/10 to-chart-2/10">
          <CardHeader>
            <CardTitle className="text-2xl">How to Activate Premium</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </span>
                <div>
                  <p className="font-medium">Contact Administrator</p>
                  <p className="text-sm text-muted-foreground">
                    Reach out to the admin with your account details
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </span>
                <div>
                  <p className="font-medium">Admin Approval</p>
                  <p className="text-sm text-muted-foreground">
                    Wait for manual activation from the administrator
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </span>
                <div>
                  <p className="font-medium">Start Learning</p>
                  <p className="text-sm text-muted-foreground">
                    Access all premium features instantly after activation
                  </p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
