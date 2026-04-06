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

describe("GET /api/enriched", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns computed rows", async () => {
    oFindMany.mockResolvedValue([
      {
        id: 1,
        isin: "US00ALDINFI01",
        aldIssuerClass: "sovereign",
        fundIssuerClassOverride: null,
        aldRegion: "na",
        fundRegionOverride: null,
        aldRatingBand: "ig",
        fundRatingBandOverride: null,
      },
    ]);
    rFindMany.mockResolvedValue([
      { id: 1, decisionCode: "ald_sov_rates_na" },
      { id: 2, decisionCode: "ald_corp_credit_na" },
      { id: 3, decisionCode: "ald_corp_credit_emea" },
    ]);
    rwFindMany.mockResolvedValue([
      { ruleId: 1, featureId: 1, weight: 0.5 },
      { ruleId: 1, featureId: 5, weight: 0.5 },
      { ruleId: 2, featureId: 2, weight: 0.4 },
      { ruleId: 2, featureId: 4, weight: 0.6 },
      { ruleId: 3, featureId: 2, weight: 0.4 },
      { ruleId: 3, featureId: 3, weight: 0.6 },
    ]);
    dFindMany.mockResolvedValue([
      { ruleId: 1, routingQueue: "Q1", slaBucket: "S1", costCenter: "C1" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].winningRuleId).toBe(1);
    expect(body.rows[0].isin).toBe("US00ALDINFI01");
  });
});
