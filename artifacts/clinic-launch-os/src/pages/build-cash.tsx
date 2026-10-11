// The Winchester Build Cash Board, built by the API from the live plan each time it is opened
// (funding pots, month by month bank, the card, the build lines). The look is the board as
// published on 11 October 2026; the figures and dates follow Launch OS.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const PROJECT_ID = 1;
const BOARD = `/api/projects/${PROJECT_ID}/boards/build-cash`;

export default function BuildCashPage() {
  const [height, setHeight] = useState(900);
  useEffect(() => {
    const fit = () => setHeight(Math.max(700, window.innerHeight - 190));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="space-y-4">
      <PageHeader title="Build Cash Board" subtitle="Funding pots, the bank month by month, the card and every build line, with the assumptions you can change. Built from the plan each time you open it."
        action={<Button asChild variant="outline" size="sm"><a href={BOARD} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1.5" />Open full screen</a></Button>} />
      <div className="rounded-md border overflow-hidden bg-background">
        <iframe src={BOARD} title="Winchester Build Cash Board" style={{ width: "100%", height, border: 0, display: "block" }} loading="eager" />
      </div>
      <p className="text-xs text-muted-foreground">The board follows the plan: change a line, its payment months or the bank balance and it shows here when you next open it. After paying anything, update Bank today on <Link href="/financials" className="underline">Money</Link>, as paid lines are taken to be in that balance. For the rooms and kit, see <Link href="/kit" className="underline">Rooms & Kit</Link>.</p>
    </div>
  );
}
