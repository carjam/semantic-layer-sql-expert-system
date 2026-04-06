import { EnrichedClient } from "./EnrichedClient";
import { loadEnrichedRows } from "@/lib/loadEnrichedRows";

export const dynamic = "force-dynamic";

export default async function EnrichedPage() {
  const rows = await loadEnrichedRows();
  return <EnrichedClient initialRows={rows} />;
}
