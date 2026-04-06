import type { Descriptor, Observation, Rule, RuleWeight } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeEnrichedRows, kernelizeFeatureIds } from "./engine";

function obs(p: Partial<Observation> & Pick<Observation, "id" | "isin">): Observation {
  return {
    aldIssuerClass: "corporate",
    fundIssuerClassOverride: null,
    aldRegion: "na",
    fundRegionOverride: null,
    aldRatingBand: "core",
    fundRatingBandOverride: null,
    ...p,
  } as Observation;
}

const demoWeights: RuleWeight[] = [
  { ruleId: 1, featureId: 1, weight: 0.5 },
  { ruleId: 1, featureId: 5, weight: 0.5 },
  { ruleId: 2, featureId: 2, weight: 0.4 },
  { ruleId: 2, featureId: 4, weight: 0.6 },
  { ruleId: 3, featureId: 2, weight: 0.4 },
  { ruleId: 3, featureId: 3, weight: 0.6 },
] as RuleWeight[];

const demoRules: Rule[] = [
  { id: 1, decisionCode: "ald_sov_rates_na" },
  { id: 2, decisionCode: "ald_corp_credit_na" },
  { id: 3, decisionCode: "ald_corp_credit_emea" },
] as Rule[];

const demoDescriptors: Descriptor[] = [
  { ruleId: 1, routingQueue: "Q1", slaBucket: "S1", costCenter: "C1" },
  { ruleId: 2, routingQueue: "Q2", slaBucket: "S2", costCenter: "C2" },
  { ruleId: 3, routingQueue: "Q3", slaBucket: "S3", costCenter: "C3" },
] as Descriptor[];

describe("kernelizeFeatureIds", () => {
  it("maps sovereign + na + ig to features 1,4,5", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "sovereign",
          aldRegion: "na",
          aldRatingBand: "ig",
        }),
      ),
    ).toEqual([1, 4, 5]);
  });

  it("maps corporate + emea (no ig) to 2,3", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "corporate",
          aldRegion: "emea",
          aldRatingBand: "core",
        }),
      ),
    ).toEqual([2, 3]);
  });

  it("uses trimmed fund override for issuer when non-empty", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "sovereign",
          fundIssuerClassOverride: "  corporate  ",
          aldRegion: "emea",
          aldRatingBand: "core",
        }),
      ),
    ).toEqual([2, 3]);
  });

  it("ignores blank override (whitespace only)", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "sovereign",
          fundIssuerClassOverride: "   ",
          aldRegion: "na",
          aldRatingBand: "ig",
        }),
      ),
    ).toEqual([1, 4, 5]);
  });

  it("uses fund region override over vendor region", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "corporate",
          aldRegion: "na",
          fundRegionOverride: "emea",
          aldRatingBand: "core",
        }),
      ),
    ).toEqual([2, 3]);
  });

  it("uses fund rating override", () => {
    expect(
      kernelizeFeatureIds(
        obs({
          id: 1,
          isin: "X",
          aldIssuerClass: "corporate",
          aldRegion: "na",
          aldRatingBand: "core",
          fundRatingBandOverride: "ig",
        }),
      ),
    ).toEqual([2, 4, 5]);
  });
});

describe("computeEnrichedRows", () => {
  it("matches demo US treasury row: wins rule 1 with descriptor", () => {
    const rows = computeEnrichedRows(
      [
        obs({
          id: 1,
          isin: "US00ALDINFI01",
          aldIssuerClass: "sovereign",
          aldRegion: "na",
          aldRatingBand: "ig",
        }),
      ],
      demoRules,
      demoWeights,
      demoDescriptors,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].winningRuleId).toBe(1);
    expect(rows[0].winningScore).toBe(1);
    expect(rows[0].descriptor).toEqual({ routingQueue: "Q1", slaBucket: "S1", costCenter: "C1" });
    expect(rows[0].scoreA).toBe(1);
    expect(rows[0].scoreB).toBe(0.6);
    expect(rows[0].scoreC).toBe(0);
  });

  it("breaks ties in favor of lower rule_id", () => {
    const weights: RuleWeight[] = [
      { ruleId: 1, featureId: 1, weight: 1 },
      { ruleId: 2, featureId: 1, weight: 1 },
    ] as RuleWeight[];
    const rules = [
      { id: 2, decisionCode: "second" },
      { id: 1, decisionCode: "first" },
    ] as Rule[];
    const rows = computeEnrichedRows(
      [obs({ id: 1, isin: "T", aldIssuerClass: "sovereign", aldRegion: "xx", aldRatingBand: "xx" })],
      rules,
      weights,
      [
        { ruleId: 1, routingQueue: "A", slaBucket: "A", costCenter: "A" },
        { ruleId: 2, routingQueue: "B", slaBucket: "B", costCenter: "B" },
      ] as Descriptor[],
    );
    expect(rows[0].winningRuleId).toBe(1);
    expect(rows[0].winningDecisionCode).toBe("first");
  });

  it("returns null descriptor when winning rule has no descriptor row", () => {
    const rows = computeEnrichedRows(
      [obs({ id: 1, isin: "T", aldIssuerClass: "sovereign", aldRegion: "na", aldRatingBand: "ig" })],
      demoRules,
      demoWeights,
      [],
    );
    expect(rows[0].winningRuleId).toBe(1);
    expect(rows[0].descriptor).toBeNull();
  });

  it("uses score slots a/b/c as zero when rules 1–3 are absent", () => {
    const rules = [{ id: 10, decisionCode: "only_ten" }] as Rule[];
    const weights = [{ ruleId: 10, featureId: 1, weight: 1 }] as RuleWeight[];
    const rows = computeEnrichedRows(
      [obs({ id: 1, isin: "T", aldIssuerClass: "sovereign", aldRegion: "na", aldRatingBand: "ig" })],
      rules,
      weights,
      [],
    );
    expect(rows[0].scoreA).toBe(0);
    expect(rows[0].scoreB).toBe(0);
    expect(rows[0].scoreC).toBe(0);
    expect(rows[0].winningRuleId).toBe(10);
    expect(rows[0].winningDecisionCode).toBe("only_ten");
  });

  it("sorts activeFeatureIds", () => {
    const rows = computeEnrichedRows(
      [obs({ id: 1, isin: "T", aldIssuerClass: "corporate", aldRegion: "na", fundRatingBandOverride: "ig" })],
      demoRules,
      demoWeights,
      demoDescriptors,
    );
    expect(rows[0].activeFeatureIds).toEqual([2, 4, 5]);
  });
});
