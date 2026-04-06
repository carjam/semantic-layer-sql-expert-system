import { enrichedRowsToCsv } from "@/lib/enrichedCsv";
import { loadEnrichedRows } from "@/lib/loadEnrichedRows";

export async function GET() {
  const rows = await loadEnrichedRows();
  const csv = enrichedRowsToCsv(rows);

  return new Response("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="enriched_observations.csv"',
      "Cache-Control": "no-store",
    },
  });
}
