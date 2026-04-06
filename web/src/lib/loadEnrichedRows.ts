import { unstable_noStore as noStore } from "next/cache";
import { computeEnrichedRows } from "@/lib/engine";
import { prisma } from "@/lib/prisma";

/** Loads observations + rules from SQLite and runs the same scoring pipeline as the SQL demos. */
export async function loadEnrichedRows() {
  noStore();
  const [observations, rules, weights, descriptors] = await Promise.all([
    prisma.observation.findMany({ orderBy: { id: "asc" } }),
    prisma.rule.findMany({ orderBy: { id: "asc" } }),
    prisma.ruleWeight.findMany(),
    prisma.descriptor.findMany(),
  ]);
  return computeEnrichedRows(observations, rules, weights, descriptors);
}
