// The Winchester opening board: where the ads stand, what is decided, the New Year offers, the
// dates that matter and what only the owner can do. Built by the API; the ad figures follow the
// latest Ads Pathway snapshot, refreshed twice a day.
import { Link } from "wouter";
import { BoardFrame } from "@/components/board-frame";

const PROJECT_ID = 1;
const BOARD = `/api/projects/${PROJECT_ID}/boards/opening`;

export default function OpeningBoardPage() {
  return (
    <BoardFrame src={BOARD} title="Winchester Opening Board" heading="Opening Board"
      subtitle="Where the ads stand, what is decided, the New Year offers, the dates to 1 March and what only you can do."
      footnote={<>The ad figures update on their own from the twice-daily pathway check; the full lead by lead trace is on <Link href="/ads-pathway" className="underline">Ads Pathway</Link>.</>} />
  );
}
