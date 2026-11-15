// The Cash Line: the Tide balance day by day from the bank date to the end of December, one row per
// payment, built by the API from the live plan each time it is opened. Under the Money verdict.
import { Link } from "wouter";
import { BoardShell } from "@/components/board-shell";
import { PROJECT_ID } from "@/lib/alfred";

export default function CashLinePage() {
  return (
    <BoardShell board="money" eyebrow="Money" title="Cash Line" back={{ href: "/money", label: "Money" }} src={`/api/projects/${PROJECT_ID}/boards/cash-line`} frameTitle="Winchester Cash Line"
      next={<>Dates are assumed where the plan holds only a month. Change a line in <Link href="/clinic/plan" className="underline">Plan and timeline</Link> or the bank on <Link href="/money?bank=1" className="underline">Money</Link> and this page follows.</>} />
  );
}
