import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function norm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t;
}

export async function GET() {
  const rows = await prisma.dimensionRule.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json({
    items: rows.map((r) => ({
      dimensionRuleId: r.id,
      dimensionName: r.dimensionName,
      dimensionValue: r.dimensionValue,
      descriptorValues: [
        r.descriptor01,
        r.descriptor02,
        r.descriptor03,
        r.descriptor04,
        r.descriptor05,
        r.descriptor06,
        r.descriptor07,
        r.descriptor08,
        r.descriptor09,
        r.descriptor10,
      ],
    })),
  });
}

type PostBody = {
  dimensionName?: unknown;
  dimensionValue?: unknown;
  descriptorValues?: unknown;
};

export async function POST(request: Request) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dimensionName = norm(body.dimensionName);
  const dimensionValue = norm(body.dimensionValue);
  const descriptorValuesRaw = Array.isArray(body.descriptorValues) ? body.descriptorValues : [];
  const descriptorValues = Array.from({ length: 10 }, (_, idx) => {
    const v = descriptorValuesRaw[idx];
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t === "" ? null : t;
  });

  if (!dimensionName || !dimensionValue || !descriptorValues[0]) {
    return NextResponse.json(
      { error: "dimensionName, dimensionValue and descriptorValues[0] are required" },
      { status: 400 },
    );
  }

  const created = await prisma.dimensionRule.create({
    data: {
      dimensionName,
      dimensionValue,
      descriptor01: descriptorValues[0],
      descriptor02: descriptorValues[1],
      descriptor03: descriptorValues[2],
      descriptor04: descriptorValues[3],
      descriptor05: descriptorValues[4],
      descriptor06: descriptorValues[5],
      descriptor07: descriptorValues[6],
      descriptor08: descriptorValues[7],
      descriptor09: descriptorValues[8],
      descriptor10: descriptorValues[9],
    },
  });

  return NextResponse.json(
    {
      item: {
        dimensionRuleId: created.id,
        dimensionName: created.dimensionName,
        dimensionValue: created.dimensionValue,
        descriptorValues: [
          created.descriptor01,
          created.descriptor02,
          created.descriptor03,
          created.descriptor04,
          created.descriptor05,
          created.descriptor06,
          created.descriptor07,
          created.descriptor08,
          created.descriptor09,
          created.descriptor10,
        ],
      },
    },
    { status: 201 },
  );
}
