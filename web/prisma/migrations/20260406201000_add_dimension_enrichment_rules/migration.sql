CREATE TABLE IF NOT EXISTS "demo_dimension_enrichment_rules" (
  "dimension_rule_id" SMALLSERIAL PRIMARY KEY,
  "dimension_name" TEXT NOT NULL,
  "dimension_value" TEXT NOT NULL,
  "descriptive_value_a" TEXT NOT NULL,
  "descriptive_value_b" TEXT,
  "descriptive_value_c" TEXT,
  "descriptive_value_d" TEXT,
  "descriptive_value_e" TEXT,
  "descriptive_value_f" TEXT,
  "descriptive_value_g" TEXT,
  "descriptive_value_h" TEXT,
  "descriptive_value_i" TEXT,
  "descriptive_value_j" TEXT
);
