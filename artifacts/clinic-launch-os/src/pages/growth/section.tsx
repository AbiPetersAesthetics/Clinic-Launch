// A Growth detail page: one section of the Ads Board (or Ads Ideas) on its own, framed from the same
// snapshot so every figure and accuracy check stays exactly as the board computes it.
import { BoardShell } from "@/components/board-shell";
import { PROJECT_ID } from "@/lib/alfred";

const SECTIONS: Record<string, { title: string; src: string; back: { href: string; label: string } }> = {
  "every-ad": { title: "Every ad and audience", src: `/api/projects/${PROJECT_ID}/boards/ads/ads`, back: { href: "/growth/ads", label: "Ads" } },
  leads: { title: "Leads", src: `/api/projects/${PROJECT_ID}/boards/ads/leads`, back: { href: "/growth/ads", label: "Ads" } },
  plan: { title: "Plan", src: `/api/projects/${PROJECT_ID}/boards/ads/plan`, back: { href: "/growth", label: "Growth" } },
  "last-14-days": { title: "Last 14 days", src: `/api/projects/${PROJECT_ID}/boards/ads/last14`, back: { href: "/growth", label: "Growth" } },
  simulator: { title: "Simulator", src: `/api/projects/${PROJECT_ID}/boards/ads/simulator`, back: { href: "/growth", label: "Growth" } },
  "how-it-works": { title: "How it works", src: `/api/projects/${PROJECT_ID}/boards/ads/how`, back: { href: "/growth", label: "Growth" } },
  ideas: { title: "Ideas", src: `/api/projects/${PROJECT_ID}/boards/ads-ideas`, back: { href: "/growth", label: "Growth" } },
  opening: { title: "Opening Board", src: `/api/projects/${PROJECT_ID}/boards/opening`, back: { href: "/more", label: "More" } },
};

export function GrowthSection({ id }: { id: string }) {
  const s = SECTIONS[id];
  if (!s) return null;
  return <BoardShell eyebrow={`Growth · ${s.title}`} title={s.title} back={s.back} src={s.src} />;
}
