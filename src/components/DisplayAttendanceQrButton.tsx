import type { Team } from "../types";

interface DisplayAttendanceQrButtonProps {
  teams: Team[];
  onLaunch: (teamId?: string) => void;
  isLaunching: boolean;
}

export function DisplayAttendanceQrButton({
  teams,
  onLaunch,
  isLaunching,
}: DisplayAttendanceQrButtonProps) {
  return (
    <div className="card">
      <h3>Display Attendance QR</h3>
      <p>Launch a new attendance QR session for all teams or a selected team.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => onLaunch(undefined)} disabled={isLaunching}>
          {isLaunching ? "Launching..." : "Launch Global QR"}
        </button>
        {teams.map((team) => (
          <button key={team.id} onClick={() => onLaunch(team.id)} disabled={isLaunching}>
            {isLaunching ? "Launching..." : `Launch ${team.name} QR`}
          </button>
        ))}
      </div>
    </div>
  );
}
