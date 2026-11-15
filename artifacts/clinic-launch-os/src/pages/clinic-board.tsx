// The Winchester Clinic Board (Diary and takings): takings, the diary ahead, ad-booked consultations
// and, from opening, attendance, no-shows, consultation to treatment and returning patients.
// Built by the API from the clinic snapshot, refreshed daily at about 07:40 from ANS.
import { BoardShell } from "@/components/board-shell";
import { PROJECT_ID } from "@/lib/alfred";

export default function ClinicBoardPage() {
  return <BoardShell eyebrow="Clinic" title="Diary and takings" back={{ href: "/clinic", label: "Clinic" }} src={`/api/projects/${PROJECT_ID}/boards/clinic`} frameTitle="Winchester Clinic Board" />;
}
