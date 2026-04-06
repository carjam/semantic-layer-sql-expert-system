import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dimensionRule: { findUnique, update, delete: remove },
  },
}));

import { DELETE, GET, PATCH } from "./route";

describe("GET /api/dimension-rules/:dimensionRuleId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns one rule", async () => {
    findUnique.mockResolvedValue({
      id: 1,
      dimensionName: "vendor_region",
      dimensionValue: "emea",
      descriptor01: "REGION_EMEA",
      descriptor02: null,
      descriptor03: null,
      descriptor04: null,
      descriptor05: null,
      descriptor06: null,
      descriptor07: null,
      descriptor08: null,
      descriptor09: null,
      descriptor10: null,
    });
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ dimensionRuleId: "1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.dimensionRuleId).toBe(1);
  });
});

describe("PATCH /api/dimension-rules/:dimensionRuleId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates fields", async () => {
    update.mockResolvedValue({
      id: 1,
      dimensionName: "vendor_region",
      dimensionValue: "na",
      descriptor01: "REGION_NA",
      descriptor02: null,
      descriptor03: null,
      descriptor04: null,
      descriptor05: null,
      descriptor06: null,
      descriptor07: null,
      descriptor08: null,
      descriptor09: null,
      descriptor10: null,
    });
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dimensionValue: "na", descriptorValues: ["REGION_NA"] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ dimensionRuleId: "1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.dimensionValue).toBe("na");
  });
});

describe("DELETE /api/dimension-rules/:dimensionRuleId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 when deleted", async () => {
    remove.mockResolvedValue({});
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ dimensionRuleId: "3" }) });
    expect(res.status).toBe(204);
  });
});
