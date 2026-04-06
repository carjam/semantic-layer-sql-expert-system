import { beforeEach, describe, expect, it, vi } from "vitest";

const rFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rule: { findMany: rFindMany },
  },
}));

import { GET } from "./route";

describe("GET /api/rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps hasDescriptor from relation", async () => {
    rFindMany.mockResolvedValue([
      { id: 1, decisionCode: "a", descriptor: { ruleId: 1 } },
      { id: 2, decisionCode: "b", descriptor: null },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        { ruleId: 1, decisionCode: "a", hasDescriptor: true },
        { ruleId: 2, decisionCode: "b", hasDescriptor: false },
      ],
    });
  });
});
