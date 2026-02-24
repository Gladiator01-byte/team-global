import { Router } from "express";
import { nonceService } from "./nonceService.js";
import { PresenterRole } from "./types.js";

export const router = Router();

router.post("/nonce/issue", async (req, res) => {
  const { teamSiteId, presenterId, presenterRole, geoHint } = req.body as {
    teamSiteId?: string;
    presenterId?: string;
    presenterRole?: PresenterRole;
    geoHint?: string;
  };

  if (!teamSiteId || !presenterId || !presenterRole) {
    return res.status(400).json({ error: "teamSiteId, presenterId, presenterRole are required" });
  }

  if (!["leader", "admin", "delegate"].includes(presenterRole)) {
    return res.status(400).json({ error: "presenterRole must be leader/admin/delegate" });
  }

  const issued = await nonceService.issueNonce({ teamSiteId, presenterId, presenterRole, geoHint });
  return res.json(issued);
});

router.post("/nonce/verify", (req, res) => {
  const { token, employeeId } = req.body as { token?: string; employeeId?: string };

  if (!token || !employeeId) {
    return res.status(400).json({ error: "token and employeeId are required" });
  }

  try {
    const verification = nonceService.consumeNonceOnce(token, employeeId);
    return res.json({ ok: true, verification });
  } catch (error) {
    const message = error instanceof Error ? error.message : "verification failed";
    return res.status(409).json({ ok: false, error: message });
  }
});

router.get("/nonce/verifications", (_req, res) => {
  return res.json({ records: nonceService.getRecords() });
});
