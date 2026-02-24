import { describe, expect, it } from "vitest";
import { NonceService } from "../server/nonceService.js";

describe("NonceService", () => {
  it("issues and consumes a nonce one time", async () => {
    const service = new NonceService();
    const { token } = await service.issueNonce({
      teamSiteId: "team-1",
      presenterId: "leader-1",
      presenterRole: "leader"
    });

    const first = service.consumeNonceOnce(token, "emp-1");
    expect(first.employeeId).toBe("emp-1");

    expect(() => service.consumeNonceOnce(token, "emp-2")).toThrow(/already used|replayed/);
  });
});
