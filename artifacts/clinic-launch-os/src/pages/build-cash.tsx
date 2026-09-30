// The Winchester Build Cash Board, framed from public/build-cash-board.html. It is the
// 30 September planning snapshot (funding pots, month by month bank, the card, the
// build lines); the live model is the Money page.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const BOARD = `${import.meta.env.BASE_URL || "/"}build-cash-board.html`.replace(/\/\//g, "/");

export default function BuildCashPage() {
  const [height, setHeight] = useState(900);
  useEffect(() => {
    const fit = () => setHeight(Math.max(700, window.innerHeight - 190));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="space-y-4">
      <PageHeader title="Build Cash Board" subtitle="Funding pots, the bank month by month, the card and every build line, with the assumptions you can change. This is the 30 September planning board; the live model is on the Money tab."
        action={<Button asChild variant="outline" size="sm"><a href={BOARD} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1.5" />Open full screen</a></Button>} />
      <div className="rounded-md border overflow-hidden bg-background">
        <iframe src={BOARD} title="Winchester Build Cash Board" style={{ width: "100%", height, border: 0, display: "block" }} loading="eager" />
      </div>
      <p className="text-xs text-muted-foreground">The figures on the board are fixed at 30 September 2026 and do not follow the plan. For today's numbers use <Link href="/financials" className="underline">Money</Link>; for the rooms and kit, <Link href="/kit" className="underline">Rooms & Kit</Link>.</p>
    </div>
  );
}
