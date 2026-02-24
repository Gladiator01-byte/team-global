import { useState } from "react";
import { QrReader } from "react-qr-reader";

interface Props {
  employeeId: string;
}

export function EmployeeScanFlow({ employeeId }: Props) {
  const [status, setStatus] = useState("Waiting for scan...");

  const handleScan = async (token: string) => {
    const response = await fetch("/api/nonce/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, employeeId })
    });

    const result = (await response.json()) as { ok: boolean; error?: string; verification?: { scanTimestamp: number } };

    if (result.ok) {
      setStatus(`Verified at ${new Date((result.verification?.scanTimestamp ?? 0) * 1000).toISOString()}`);
      return;
    }

    setStatus(`Rejected: ${result.error ?? "Unknown error"}`);
  };

  return (
    <section>
      <h2>Employee QR Scan</h2>
      <QrReader
        constraints={{ facingMode: "environment" }}
        onResult={(result, error) => {
          if (result?.getText()) {
            void handleScan(result.getText());
          }

          if (error) {
            setStatus("Scanning...");
          }
        }}
      />
      <p>{status}</p>
    </section>
  );
}
