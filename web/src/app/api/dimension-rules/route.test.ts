import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dimensionRule: { findMany, create },
  },
}));

import { GET, POST } from "./route";

describe("GET /api/dimension-rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists dimension rules", async () => {
    findMany.mockResolvedValue([
      {
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
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].dimensionRuleId).toBe(1);
    expect(body.items[0].dimensionName).toBe("vendor_region");
  });
});

describe("POST /api/dimension-rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a rule", async () => {
    create.mockResolvedValue({
      id: 2,
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
    const req = new Request("http://localhost/api/dimension-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dimensionName: "vendor_region",
        dimensionValue: "na",
        descriptorValues: ["REGION_NA"],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.dimensionRuleId).toBe(2);
  });
});
