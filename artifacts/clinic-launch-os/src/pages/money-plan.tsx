// The Winchester Money Plan, built by the API from the live plan each time it is opened: the
// forecasts, Bedhampton and pay options, the recommended plan month by month and "Try it
// yourself". The look is the plan as published on 11 October 2026; the figures follow Launch OS.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const PROJECT_ID = 1;
const PLAN = `/api/projects/${PROJECT_ID}/boards/money-plan`;

export default function MoneyPlanPage() {
  const [height, setHeight] = useState(900);
  useEffect(() => {
    const fit = () => setHeight(Math.max(700, window.innerHeight - 190));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="space-y-4">
      <PageHeader title="Money Plan" subtitle="How Winchester pays for itself: the forecasts, what happens to Bedhampton, when pay starts, and the plan month by month. Built from the plan each time you open it."
        action={<Button asChild variant="outline" size="sm"><a href={PLAN} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1.5" />Open full screen</a></Button>} />
      <div className="rounded-md border overflow-hidden bg-background">
        <iframe src={PLAN} title="The Winchester Money Plan" style={{ width: "100%", height, border: 0, display: "block" }} loading="eager" />
      </div>
      <p className="text-xs text-muted-foreground">The plan reads the same figures as <Link href="/financials" className="underline">Money</Link>, so the two always agree. Changes made in "Try it yourself" are for exploring and are not saved.</p>
    </div>
  );
}
