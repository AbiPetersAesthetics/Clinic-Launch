// The Winchester Money Plan, built by the API from the live plan each time it is opened: the
// forecasts, Bedhampton and pay options, the recommended plan month by month and "Try it
// yourself". The look is the plan as published on 11 October 2026; the figures follow Launch OS.
import { Link } from "wouter";
import { BoardFrame } from "@/components/board-frame";

const PROJECT_ID = 1;
const PLAN = `/api/projects/${PROJECT_ID}/boards/money-plan`;

export default function MoneyPlanPage() {
  return (
    <BoardFrame src={PLAN} title="The Winchester Money Plan" heading="Money Plan"
      subtitle="How Winchester pays for itself: the forecasts, what happens to Bedhampton, when pay starts, and the plan month by month. Built from the plan each time you open it."
      footnote={<>The plan reads the same figures as <Link href="/financials" className="underline">Money</Link>, so the two always agree. Changes made in "Try it yourself" are for exploring and are not saved.</>} />
  );
}
