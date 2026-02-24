import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config.js";
import { broadcastNonceUpdate } from "./supabaseRealtime.js";
import { NoncePayload, PresenterRole, VerificationRecord } from "./types.js";

interface PresenterInput {
  teamSiteId: string;
  presenterId: string;
  presenterRole: PresenterRole;
  geoHint?: string;
}

const pickLifetimeSec = (): number => {
  const min = config.nonceMinLifetimeSec;
  const max = config.nonceMaxLifetimeSec;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export class NonceService {
  private usedNonces = new Set<string>();
  private verificationRecords: VerificationRecord[] = [];

  async issueNonce(input: PresenterInput): Promise<{ token: string; payload: NoncePayload }> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + pickLifetimeSec();

    const payload: NoncePayload = {
      nonceId: uuidv4(),
      iat: now,
      exp,
      teamSiteId: input.teamSiteId,
      presenterId: input.presenterId,
      presenterRole: input.presenterRole,
      geoHint: input.geoHint
    };

    const token = jwt.sign(payload, config.jwtSecret, { algorithm: "HS256" });
    await broadcastNonceUpdate(payload);

    return { token, payload };
  }

  verifySignature(token: string): NoncePayload {
    return jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as NoncePayload;
  }

  consumeNonceOnce(token: string, employeeId: string): VerificationRecord {
    const payload = this.verifySignature(token);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp <= now) {
      throw new Error("Nonce expired");
    }

    if (this.usedNonces.has(payload.nonceId)) {
      throw new Error("Nonce already used or replayed");
    }

    this.usedNonces.add(payload.nonceId);

    const record: VerificationRecord = {
      nonceId: payload.nonceId,
      employeeId,
      scanTimestamp: now,
      teamSiteId: payload.teamSiteId,
      presenterId: payload.presenterId
    };

    this.verificationRecords.push(record);

    return record;
  }

  getRecords(): VerificationRecord[] {
    return this.verificationRecords;
  }
}

export const nonceService = new NonceService();
