export type PresenterRole = "leader" | "admin" | "delegate";

export interface NoncePayload {
  nonceId: string;
  iat: number;
  exp: number;
  teamSiteId: string;
  presenterId: string;
  presenterRole: PresenterRole;
  geoHint?: string;
}

export interface VerificationRecord {
  nonceId: string;
  employeeId: string;
  scanTimestamp: number;
  teamSiteId: string;
  presenterId: string;
}
