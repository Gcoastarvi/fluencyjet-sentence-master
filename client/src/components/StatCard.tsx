import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  className?: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-primary",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("hover-elevate", className)} data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-serif">{value}</p>
          </div>
          <Icon className={cn("w-8 h-8", iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
}
