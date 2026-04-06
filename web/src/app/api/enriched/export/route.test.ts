import { beforeEach, describe, expect, it, vi } from "vitest";

const oFindMany = vi.hoisted(() => vi.fn());
const rFindMany = vi.hoisted(() => vi.fn());
const rwFindMany = vi.hoisted(() => vi.fn());
const dFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    observation: { findMany: oFindMany },
    rule: { findMany: rFindMany },
    ruleWeight: { findMany: rwFindMany },
    descriptor: { findMany: dFindMany },
  },
}));

import { GET } from "./route";

describe("GET /api/enriched/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns CSV with BOM and attachment headers", async () => {
    oFindMany.mockResolvedValue([
      {
        id: 1,
        isin: "X",
        aldIssuerClass: "sovereign",
        fundIssuerClassOverride: null,
        aldRegion: "na",
        fundRegionOverride: null,
        aldRatingBand: "ig",
        fundRatingBandOverride: null,
      },
    ]);
    rFindMany.mockResolvedValue([{ id: 1, decisionCode: "d1" }]);
    rwFindMany.mockResolvedValue([
      { ruleId: 1, featureId: 1, weight: 1 },
    ]);
    dFindMany.mockResolvedValue([{ ruleId: 1, routingQueue: "Q", slaBucket: "S", costCenter: "C" }]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
    const text = new TextDecoder("utf-8").decode(buf.subarray(3));
    expect(text).toContain("obs_id");
    expect(text).toContain("X");
  });
});
