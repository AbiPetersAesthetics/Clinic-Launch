// Ads Ideas: seasonal, creative, funnel and retention approaches for Meta that could lift ROAS, with
// published benchmarks. Built by the API from ads/meta/ideas.json in the website repo.
import { Link } from "wouter";
import { BoardFrame } from "@/components/board-frame";

const PROJECT_ID = 1;
const BOARD = `/api/projects/${PROJECT_ID}/boards/ads-ideas`;

export default function AdsIdeasPage() {
  return (
    <BoardFrame src={BOARD} title="Ads Ideas" heading="Ads Ideas"
      subtitle="Approaches that could lift our return on ad spend, each with its evidence, expected effect, effort and the advertising rules, plus the published benchmarks."
      footnote={<>Chosen ideas move into the 12 month calendar on the <Link href="/ads-board" className="underline">Ads Board</Link>.</>} />
  );
}
