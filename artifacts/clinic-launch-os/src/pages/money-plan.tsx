// The Winchester Money Plan, built by the API from the live plan each time it is opened: the
// forecasts, Bedhampton and pay options, the plan month by month and "Try it yourself".
import { BoardShell } from "@/components/board-shell";
import { PROJECT_ID } from "@/lib/alfred";

export default function MoneyPlanPage() {
  return (
    <BoardShell board="money" eyebrow="Money" title="Money Plan" back={{ href: "/money", label: "Money" }} src={`/api/projects/${PROJECT_ID}/boards/money-plan`} frameTitle="The Winchester Money Plan"
      next={<>The plan reads the same figures and bank balance as Money, so the two always agree. Changes in "Try it yourself" are for exploring and are not saved.</>} />
  );
}
