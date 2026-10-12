// The Winchester Build Cash Board, built by the API from the live plan each time it is opened
// (funding pots, month by month bank, the card, the build lines). The look is the board as
// published on 11 October 2026; the figures and dates follow Launch OS.
import { Link } from "wouter";
import { BoardFrame } from "@/components/board-frame";

const PROJECT_ID = 1;
const BOARD = `/api/projects/${PROJECT_ID}/boards/build-cash`;

export default function BuildCashPage() {
  return (
    <BoardFrame src={BOARD} title="Winchester Build Cash Board" heading="Build Cash Board"
      subtitle="Funding pots, the bank month by month, the card and every build line, with the assumptions you can change. Built from the plan each time you open it."
      footnote={<>The board follows the plan: change a line, its payment months or the bank balance and it shows here when you next open it. After paying anything from the bank, update Bank today on <Link href="/financials" className="underline">Money</Link>; anything bought on a card goes on that card in <Link href="/cards" className="underline">Credit Cards</Link>. For the rooms and kit, see <Link href="/kit" className="underline">Rooms & Kit</Link>.</>} />
  );
}
