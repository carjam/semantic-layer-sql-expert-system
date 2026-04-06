import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ dimensionRuleId: string }> };

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function norm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t;
}

export async function GET(_request: Request, context: Ctx) {
  const { dimensionRuleId: raw } = await context.params;
  const id = parseId(raw);
  if (id === null) return NextResponse.json({ error: "Invalid dimensionRuleId" }, { status: 400 });

  const row = await prisma.dimensionRule.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Dimension rule not found" }, { status: 404 });

  return NextResponse.json({
    item: {
      dimensionRuleId: row.id,
      dimensionName: row.dimensionName,
      dimensionValue: row.dimensionValue,
      descriptorValues: [
        row.descriptor01,
        row.descriptor02,
        row.descriptor03,
        row.descriptor04,
        row.descriptor05,
        row.descriptor06,
        row.descriptor07,
        row.descriptor08,
        row.descriptor09,
        row.descriptor10,
      ],
    },
  });
}

type PatchBody = {
  dimensionName?: unknown;
  dimensionValue?: unknown;
  descriptorValues?: unknown;
};

export async function PATCH(request: Request, context: Ctx) {
  const { dimensionRuleId: raw } = await context.params;
  const id = parseId(raw);
  if (id === null) return NextResponse.json({ error: "Invalid dimensionRuleId" }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: {
    dimensionName?: string;
    dimensionValue?: string;
    descriptor01?: string;
    descriptor02?: string | null;
    descriptor03?: string | null;
    descriptor04?: string | null;
    descriptor05?: string | null;
    descriptor06?: string | null;
    descriptor07?: string | null;
    descriptor08?: string | null;
    descriptor09?: string | null;
    descriptor10?: string | null;
  } = {};

  if (body.dimensionName !== undefined) {
    const v = norm(body.dimensionName);
    if (!v) return NextResponse.json({ error: "dimensionName must be non-empty string" }, { status: 400 });
    data.dimensionName = v;
  }
  if (body.dimensionValue !== undefined) {
    const v = norm(body.dimensionValue);
    if (!v) return NextResponse.json({ error: "dimensionValue must be non-empty string" }, { status: 400 });
    data.dimensionValue = v;
  }
  if (body.descriptorValues !== undefined) {
    if (!Array.isArray(body.descriptorValues)) {
      return NextResponse.json({ error: "descriptorValues must be an array" }, { status: 400 });
    }
    const values = Array.from({ length: 10 }, (_, idx) => {
      const v = body.descriptorValues?.[idx];
      if (typeof v !== "string") return null;
      const t = v.trim();
      return t === "" ? null : t;
    });
    if (!values[0]) return NextResponse.json({ error: "descriptorValues[0] must be non-empty" }, { status: 400 });
    data.descriptor01 = values[0];
    data.descriptor02 = values[1];
    data.descriptor03 = values[2];
    data.descriptor04 = values[3];
    data.descriptor05 = values[4];
    data.descriptor06 = values[5];
    data.descriptor07 = values[6];
    data.descriptor08 = values[7];
    data.descriptor09 = values[8];
    data.descriptor10 = values[9];
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  try {
    const updated = await prisma.dimensionRule.update({ where: { id }, data });
    return NextResponse.json({
      item: {
        dimensionRuleId: updated.id,
        dimensionName: updated.dimensionName,
        dimensionValue: updated.dimensionValue,
        descriptorValues: [
          updated.descriptor01,
          updated.descriptor02,
          updated.descriptor03,
          updated.descriptor04,
          updated.descriptor05,
          updated.descriptor06,
          updated.descriptor07,
          updated.descriptor08,
          updated.descriptor09,
          updated.descriptor10,
        ],
      },
    });
  } catch {
    return NextResponse.json({ error: "Dimension rule not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const { dimensionRuleId: raw } = await context.params;
  const id = parseId(raw);
  if (id === null) return NextResponse.json({ error: "Invalid dimensionRuleId" }, { status: 400 });

  try {
    await prisma.dimensionRule.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Dimension rule not found" }, { status: 404 });
  }
}
