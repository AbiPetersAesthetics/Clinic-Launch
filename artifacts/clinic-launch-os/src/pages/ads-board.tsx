// The Winchester Ads Board: the command centre for paid ads. Every ad now, cost per paying patient
// and ROAS, the scheduled runs that collect the data, and the next 12 months of campaigns.
// Built by the API from the latest Ads Pathway snapshot and its plan (ads/meta/pathway/ads-plan.json).
import { Link } from "wouter";
import { BoardFrame } from "@/components/board-frame";

const PROJECT_ID = 1;
const BOARD = `/api/projects/${PROJECT_ID}/boards/ads`;

export default function AdsBoardPage() {
  return (
    <BoardFrame src={BOARD} title="Winchester Ads Board" heading="Ads Board"
      subtitle="Every ad now, what a paying patient costs and the return on ad spend, how the data is collected, and the next 12 months of campaigns."
      footnote={<>Updates from the daily pathway check and the Monday capacity review. Every lead, traced from ad to diary, is on <Link href="/ads-pathway" className="underline">Ads Pathway</Link>.</>} />
  );
}
