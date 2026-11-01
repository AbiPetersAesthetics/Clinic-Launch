// The Cash Line: the Tide balance day by day from the bank date to the end of December, one
// row per payment, built by the API from the live plan each time it is opened.
import { Link } from "wouter";
import { BoardFrame } from "@/components/board-frame";

const PROJECT_ID = 1;
const BOARD = `/api/projects/${PROJECT_ID}/boards/cash-line`;

export default function CashLinePage() {
  return (
    <BoardFrame src={BOARD} title="Winchester Cash Line" heading="Cash Line"
      subtitle="The Tide balance day by day to the end of December: every payment in the plan on the day it is expected, and what it does to the bank. Card and personal rows leave the line where it is."
      footnote={<>The dates are assumed where the plan holds only a month; they are listed at the foot of the page. The amounts are the plan's: change a line in <Link href="/project" className="underline">Plan & Timeline</Link>, or the bank balance on <Link href="/financials" className="underline">Money</Link>, and this page follows.</>} />
  );
}
