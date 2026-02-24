import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type SessionState = "idle" | "running" | "paused" | "stopped";

interface IssuedNonce {
  token: string;
  payload: {
    exp: number;
    iat: number;
  };
}

interface Props {
  teamSiteId: string;
  presenterId: string;
}

export function LeaderDisplayPage({ teamSiteId, presenterId }: Props) {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [nonce, setNonce] = useState<IssuedNonce | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const fetchNonce = async () => {
    const response = await fetch("/api/nonce/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamSiteId, presenterId, presenterRole: "leader" })
    });
    const data = (await response.json()) as IssuedNonce;
    setNonce(data);
    setTimeLeft(data.payload.exp - Math.floor(Date.now() / 1000));
  };

  useEffect(() => {
    if (sessionState !== "running") {
      return;
    }

    void fetchNonce();
    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          void fetchNonce();
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionState]);

  const sessionLabel = useMemo(() => {
    switch (sessionState) {
      case "running":
        return "Active";
      case "paused":
        return "Paused";
      case "stopped":
        return "Stopped";
      default:
        return "Idle";
    }
  }, [sessionState]);

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "#111", color: "#fff" }}>
      <section style={{ textAlign: "center" }}>
        <h1>Leader Session Display</h1>
        <p>State: {sessionLabel}</p>
        <p>Nonce refresh in: {timeLeft}s</p>
        {nonce && <QRCodeSVG value={nonce.token} size={320} bgColor="#fff" fgColor="#111" />}
        <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => setSessionState("running")}>Start</button>
          <button onClick={() => setSessionState("paused")}>Pause</button>
          <button onClick={() => setSessionState("stopped")}>Stop</button>
        </div>
      </section>
    </main>
  );
}
