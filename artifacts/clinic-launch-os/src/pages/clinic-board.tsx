// The Winchester Clinic Board: takings, the diary ahead, ad-booked consultations, and from opening
// attendance, no-shows, consultation to treatment and returning patients. Built by the API from ANS
// data refreshed every morning.
import { BoardFrame } from "@/components/board-frame";

const PROJECT_ID = 1;
const BOARD = `/api/projects/${PROJECT_ID}/boards/clinic`;

export default function ClinicBoardPage() {
  return (
    <BoardFrame src={BOARD} title="Winchester Clinic Board" heading="Clinic Board"
      subtitle="How the clinics are running: takings, the diary ahead, and from opening who turns up, who goes on to treatment and who comes back."
      footnote={<>Refreshed every morning at 07:30 from ANS. Only real figures are shown.</>} />
  );
}
