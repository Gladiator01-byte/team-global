import type { QrSession } from "../types";

interface ActiveQrSessionsMonitorProps {
  sessions: QrSession[];
  isLoading?: boolean;
}

export function ActiveQrSessionsMonitor({
  sessions,
  isLoading,
}: ActiveQrSessionsMonitorProps) {
  return (
    <div className="card">
      <h3>Active QR Sessions</h3>
      {isLoading && <p>Loading active sessions...</p>}
      {!isLoading && sessions.length === 0 && <p>No active sessions.</p>}
      {sessions.length > 0 && (
        <ul>
          {sessions.map((session) => (
            <li key={session.id}>
              <strong>{session.teamName ?? "Global"}</strong> · Scans: {session.scansCount} ·
              Expires: {new Date(session.expiresAtIso).toLocaleTimeString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
