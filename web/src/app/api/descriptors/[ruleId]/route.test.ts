import { beforeEach, describe, expect, it, vi } from "vitest";

const dFindUnique = vi.hoisted(() => vi.fn());
const dUpdate = vi.hoisted(() => vi.fn());
const dDelete = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    descriptor: {
      findUnique: dFindUnique,
      update: dUpdate,
      delete: dDelete,
    },
  },
}));

import { DELETE, GET, PATCH } from "./route";

const ctx = (ruleId: string) => ({ params: Promise.resolve({ ruleId }) });

describe("GET /api/descriptors/[ruleId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid ruleId", async () => {
    const res = await GET(new Request("http://x"), ctx("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when not found", async () => {
    dFindUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://x"), ctx("1"));
    expect(res.status).toBe(404);
  });

  it("returns item when found", async () => {
    dFindUnique.mockResolvedValue({
      ruleId: 1,
      routingQueue: "Q",
      slaBucket: "S",
      costCenter: "C",
      rule: { decisionCode: "dc" },
    });
    const res = await GET(new Request("http://x"), ctx("1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      item: { ruleId: 1, decisionCode: "dc", routingQueue: "Q", slaBucket: "S", costCenter: "C" },
    });
  });
});

describe("PATCH /api/descriptors/[ruleId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for bad ruleId", async () => {
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: "{}", headers: { "Content-Type": "application/json" } }),
      ctx("0"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: "{", headers: { "Content-Type": "application/json" } }),
      ctx("1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when no fields", async () => {
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: "{}", headers: { "Content-Type": "application/json" } }),
      ctx("1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty routingQueue string", async () => {
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ routingQueue: "  " }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx("1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-string routingQueue", async () => {
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ routingQueue: 1 }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx("1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty costCenter when provided", async () => {
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ costCenter: "" }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx("1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty slaBucket when provided", async () => {
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ slaBucket: "  " }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx("1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when costCenter is not a string", async () => {
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ costCenter: false }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx("1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when update throws", async () => {
    dUpdate.mockRejectedValue(new Error("not found"));
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ slaBucket: "x" }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx("1"),
    );
    expect(res.status).toBe(404);
  });

  it("updates successfully", async () => {
    dUpdate.mockResolvedValue({
      ruleId: 1,
      routingQueue: "Q",
      slaBucket: "S2",
      costCenter: "C",
      rule: { decisionCode: "dc" },
    });
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ slaBucket: "S2" }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx("1"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ item: { slaBucket: "S2" } });
  });

  it("trims routingQueue on successful patch", async () => {
    dUpdate.mockResolvedValue({
      ruleId: 1,
      routingQueue: "trimmed",
      slaBucket: "S",
      costCenter: "C",
      rule: { decisionCode: "dc" },
    });
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ routingQueue: "  trimmed  " }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx("1"),
    );
    expect(res.status).toBe(200);
    expect(dUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ routingQueue: "trimmed" }),
      }),
    );
  });

  it("trims costCenter on successful patch", async () => {
    dUpdate.mockResolvedValue({
      ruleId: 1,
      routingQueue: "Q",
      slaBucket: "S",
      costCenter: "BOOK",
      rule: { decisionCode: "dc" },
    });
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ costCenter: "  BOOK  " }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx("1"),
    );
    expect(res.status).toBe(200);
    expect(dUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ costCenter: "BOOK" }),
      }),
    );
  });

  it("returns 400 when slaBucket is not a string", async () => {
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ slaBucket: 99 }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx("1"),
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/descriptors/[ruleId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid id", async () => {
    const res = await DELETE(new Request("http://x"), ctx("nope"));
    expect(res.status).toBe(400);
  });

  it("returns 204 on success", async () => {
    dDelete.mockResolvedValue(undefined);
    const res = await DELETE(new Request("http://x"), ctx("2"));
    expect(res.status).toBe(204);
  });

  it("returns 404 when delete throws", async () => {
    dDelete.mockRejectedValue(new Error("missing"));
    const res = await DELETE(new Request("http://x"), ctx("2"));
    expect(res.status).toBe(404);
  });
});
