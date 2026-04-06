import { beforeEach, describe, expect, it, vi } from "vitest";

const dFindMany = vi.hoisted(() => vi.fn());
const dFindUnique = vi.hoisted(() => vi.fn());
const dCreate = vi.hoisted(() => vi.fn());
const rFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    descriptor: {
      findMany: dFindMany,
      findUnique: dFindUnique,
      create: dCreate,
    },
    rule: { findUnique: rFindUnique },
  },
}));

import { GET, POST } from "./route";

describe("GET /api/descriptors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped items", async () => {
    dFindMany.mockResolvedValue([
      {
        ruleId: 1,
        routingQueue: "Q",
        slaBucket: "S",
        costCenter: "C",
        rule: { decisionCode: "d1" },
      },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([
      { ruleId: 1, decisionCode: "d1", routingQueue: "Q", slaBucket: "S", costCenter: "C" },
    ]);
  });
});

describe("POST /api/descriptors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing ruleId", async () => {
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ routingQueue: "a", slaBucket: "b", costCenter: "c" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new Request("http://localhost/api/descriptors", {
      method: "POST",
      body: "not-json{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects non-integer ruleId", async () => {
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ruleId: 1.5, routingQueue: "a", slaBucket: "b", costCenter: "c" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects ruleId zero", async () => {
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ruleId: 0, routingQueue: "a", slaBucket: "b", costCenter: "c" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects NaN ruleId from string", async () => {
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ruleId: "x", routingQueue: "a", slaBucket: "b", costCenter: "c" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects empty required strings", async () => {
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ruleId: 1, routingQueue: "  ", slaBucket: "b", costCenter: "c" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when rule missing", async () => {
    rFindUnique.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ruleId: 2, routingQueue: "a", slaBucket: "b", costCenter: "c" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when descriptor exists", async () => {
    rFindUnique.mockResolvedValue({ id: 2 });
    dFindUnique.mockResolvedValue({ ruleId: 2 });
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ruleId: 2, routingQueue: "a", slaBucket: "b", costCenter: "c" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(409);
  });

  it("creates and returns 201", async () => {
    rFindUnique.mockResolvedValue({ id: 1 });
    dFindUnique.mockResolvedValue(null);
    dCreate.mockResolvedValue({
      ruleId: 1,
      routingQueue: "RQ",
      slaBucket: "SL",
      costCenter: "CC",
      rule: { decisionCode: "code" },
    });
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ruleId: 1, routingQueue: "RQ", slaBucket: "SL", costCenter: "CC" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item).toMatchObject({
      ruleId: 1,
      decisionCode: "code",
      routingQueue: "RQ",
      slaBucket: "SL",
      costCenter: "CC",
    });
  });

  it("accepts ruleId as JSON number", async () => {
    rFindUnique.mockResolvedValue({ id: 4 });
    dFindUnique.mockResolvedValue(null);
    dCreate.mockResolvedValue({
      ruleId: 4,
      routingQueue: "a",
      slaBucket: "b",
      costCenter: "c",
      rule: { decisionCode: "d" },
    });
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ruleId: 4, routingQueue: "a", slaBucket: "b", costCenter: "c" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
  });

  it("accepts numeric ruleId from JSON string coercion", async () => {
    rFindUnique.mockResolvedValue({ id: 3 });
    dFindUnique.mockResolvedValue(null);
    dCreate.mockResolvedValue({
      ruleId: 3,
      routingQueue: "a",
      slaBucket: "b",
      costCenter: "c",
      rule: { decisionCode: "d" },
    });
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ruleId: "3", routingQueue: "a", slaBucket: "b", costCenter: "c" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
  });
});
