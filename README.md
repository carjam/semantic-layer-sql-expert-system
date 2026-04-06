# SQL expert system + semantic layer (portfolio)

## Expert system first—also a semantic layer

**Primary lens: expert system.** Qualitative business facts (classifications, regions, rating bands) are matched against wildcard rules, scored with sparse matrix-style compatibility, and resolved by deterministic argmax. Rules are human-authored and auditable.

**Also a semantic layer.** Fund-owned overrides (`fund_*_override`) sit on top of vendor reference attributes (`ald_*`) to produce **effective** labels used for scoring, while vendor lineage remains on each enriched row.

## Situation & solution (read this first)

**Platform reality:** vendor-defined classification hierarchies arrive with each security.

**Portfolio need:** fund teams still need custom grouping/routing when their taxonomy differs from the vendor taxonomy.

**System response:** optional fund overrides produce effective labels for scoring/routing while keeping raw vendor fields for lineage and audit.

**What this repository demonstrates:** The same idea in **minimal SQL**: synthetic `ald_*` + nullable `fund_*_override` → **effective** → kernelization → sparse matrix-style scores → argmax → **`ENRICHED_OBSERVATION_ROW`**. The worked example includes a **fund region override** that rebooks a US corporate from **NA** to **EMEA** for internal aggregation **without** editing the vendor feed.

*Aladdin® is a registered trademark of BlackRock, Inc. This project is **not** affiliated with BlackRock, uses **no** vendor or production data, and all ISINs are **fabricated**.*

This repository is a **public, synthetic** companion to a production system I designed and built at a former employer. See the technical primer below plus worked sample I/O.

## What this repo is for

- **Interview narrative:** Production context, constraints, performance, integrations, and lessons in `docs/case-study.md` (this README holds the **Aladdin-style FI demo**, **technical primer**, **worked example**, and quick starts).
- **Technical proof of familiarity:** Run the SQL scripts end-to-end and inspect canonical outputs (`HIERARCHY_RULE_SPACE`, `ENRICHED_OBSERVATION_ROW`) plus the shared Postgres routines.
- **Not a reproduction:** No proprietary schemas, data, or code from the employer; ISINs and attributes are **fabricated** for pedagogy.

## Intuitive result view

The UI can render many columns for diagnostics, but the core intuition is straightforward: left-side observation context, right-side scores and attached descriptors after winner selection.

![Simplified enriched output: key observation context plus winning enrichment fields](docs/images/enriched-output-simple.png)

## How the scoring engine works

### Kernelization, matrix-style scoring, and gating

**Qualitative → numeric.** Vendor and fund-side fields are **categorical** (issuer class, region, rating band, …). **Kernelization** maps each row’s **effective** labels into a **sparse binary vector** $d_j \in \{0,1\}^M$ over a **fixed dictionary** of atomic features (e.g. `fi_corporate`, `region_emea`). That step is the bridge from **qualitative data** to something algebra can consume—without pretending the categories were already real numbers.

**Matrix-style scoring under constraints.** Each observation is mapped to a normalized hierarchy (levels 1..7; levels 1..3 are commonly used), kernelized into sparse axis-value features, then scored against kernelized hierarchy rules via sparse dot-product. Compatibility constraints still apply (`*` means "axis not specified"; non-wildcard mismatches are rejected). Score is normalized by the number of non-wildcard rule axes (minimum denominator `3` for backward compatibility), and each decision keeps the best matching hierarchy rule score. Hierarchy levels remain generic slots; separate one-level dimension enrichment is handled independently.

**Logic gating.** The discrete choice $\arg\max_i s_{ij}$ (with a fixed tie-break) is a **hard winner-take-all gate**: one outcome “on,” the rest “off.” There is **no softmax**, **no depth**, and **no training loop** in this artifact.

**Resemblance to a tiny net.** You can still view this as “score vector + hard gate.” In this demo, the score vector is produced by sparse matrix-style dot products over kernelized hierarchy dimensions.

### Stakeholder view (what each run decides)

For each security, the engine picks one workstream (argmax) and attaches descriptors. Inputs are vendor fields plus optional fund overrides; scoring uses effective values. Output is one enriched row per security with both lineage and decision artifacts.

**Separated for clarity (facts vs policy vs math):**

- **Data / structure (facts in the demo):** For each dimension, **effective value** = non-blank **fund override** if set, else **`ald_*` vendor value**. A normalized hierarchy is derived from effective issuer (`Debt/Govt|Corp|Deriv/<issuer>`). Hierarchy rules allow wildcards and include a `rule_id` target plus semantic descriptor fields.
- **Business policy (declared, not learned):** The winning outcome is the one with the **highest score**; **ties** resolve by a **fixed ordering** on outcome id (`rule_id` in SQL). Production also used precedence “waterfall” rules—see `docs/case-study.md`.
- **What is *not* decided here:** Continuous allocation, budgets, or solver-tuned decision vectors; there is **no** numerical optimization over a free $x\in\mathbb{R}^n$ in this pattern.

### Technical primer: matrix-style scoring and argmax gate

**Notation.** $N$ = number of outcomes (workstreams). For observation $j$, hierarchy matching yields a score vector $(s_{1j}, \ldots, s_{Nj})$ where each $s_{ij}$ is the maximum compatibility score among hierarchy rows mapped to outcome $i$.

**Hierarchy score (sparse kernel dot-product under constraints).** For each hierarchy rule $r$ and observation $j$, build sparse vectors over hierarchy axes (up to 7 levels) and compute:

$$
\text{score}_{rj} =
\begin{cases}
\dfrac{d_j^\top k_r}{\max(\|k_r\|_0, 3)}, & \text{if all non-wildcard axes in } r \text{ match } j\\
0, & \text{otherwise}
\end{cases}
$$

and the outcome score is the maximum rule score among rows for that outcome.

The denominator is **not a fixed `/3`**. It is the rule's non-wildcard axis count, with a floor of `3` retained for backward compatibility with the original 3-level scoring behavior.

**Wide scores and ranking.** Internally the enriched routine still forms outcome score slots (`a`,`b`,`c`) and applies argmax ranking deterministically (tie-break by `rule_id`).

**Logic gate (hard max).** The discrete decision is

$$
i^\star(j) \in \arg\max_{i=1,\ldots,N} s_{ij},
$$

with a **deterministic tie-break** among argmax ties (smallest `rule_id` in the demo). That is winner-take-all gating: no softmax, no temperature, no gradient-based learning.

**Problem class (precision).** This is **not** LP, QP, or MILP in the sense of optimizing a continuous or mixed-integer decision $x$ subject to constraints. The mathematics is **linear functionals** of fixed binary $d_j$ plus **discrete maximization** over a **finite** label set—fast to evaluate and easy to audit, at the cost of no built-in uncertainty quantification.

### From matrix to tensor-like extension

The original pattern is a 2D scoring surface (observations x hierarchy rules). With added independent dimension rules (for example region grouping), the conceptual model becomes multi-axis: observation x rule-family x rule-index.

In practice, we execute multiple sparse 2D computations (one per rule family) and merge deterministically:
- hierarchy family: sparse compatibility scoring + argmax for decisioning
- dimension family: one-level rule matching for additional descriptors

So the architecture generalizes toward a tensor-like model while keeping SQL execution simple, performant, and auditable.

### Runtime practicality at large scale

This is practical at runtime because evaluation is sparse matching + aggregation, not repeated string-heavy row logic.

- **At-a-glance flow:** ingest -> apply overrides -> derive effective labels -> sparse score aggregation -> argmax -> attach hierarchy + dimension descriptors.
- **Why it scales:** sparse kernels mean each observation activates only a small subset of features, so scoring cost grows with active features, not with the full rule text surface.
- **Latency control:** precompute or incrementally refresh observation feature projections; avoid rebuilding kernels from raw text for every request.
- **Database fit:** B-tree indexes on join keys (`observation_id`, `rule_id`, feature axis/value) and selective entry points (TVFs/endpoints with required filters) keep plans stable under load.
- **Throughput pattern:** batch scoring for changed observations and cache immutable rule kernels between rule-set versions.
- **Operational guardrails:** version rule snapshots and record which snapshot scored each row so results stay explainable after rule edits.

### Reproducibility

- **Fixture:** `sql/postgres/demo.sql` (seven **synthetic** FI rows with **`ald_*` + `fund_*_override`**, three workstreams, all `INSERT`s in-script).
- **Canonical Postgres routines:** `demo_get_dense_scores()` and `demo_get_enriched_rows()` are created by `sql/postgres/demo.sql` and act as the shared scoring/enrichment source used by both SQL output sections and the web API.
- **Command:** Run the PostgreSQL quick start section below.
- **Full Postgres run (no local `psql`):** With **Docker** running (e.g. Docker Desktop), from repo root run `.\scripts\run_postgres_demo_docker.ps1` (Windows) or `bash scripts/run_postgres_demo_docker.sh` (macOS/Linux). This starts an **ephemeral** `postgres:16-alpine` container, executes the demo, prints all result sets (including **`ENRICHED_OBSERVATION_ROW`**), then removes the container.
- **Syntax check (no DB):** `pip install pglast` then `python scripts/verify_postgres_demo.py` — confirms the Postgres script is valid SQL (verified in development: **27** statements parse cleanly).
- **Toy UI (Next.js):** `web/` — Postgres + Prisma mapped to the same `demo_*` tables used by `sql/postgres/demo.sql`, with CRUD for **hierarchy rules** (`rule_id` + variable-depth pattern levels 1..7 + up to 10 descriptor columns) plus one-level **dimension rules** (`/api/dimension-rules`), enriched output page, and `/api-docs` with OpenAPI. See `web/.env.example`, run the Postgres demo SQL once, then run `cd web && npm install && npm run db:generate && npm run dev`.

- **Main result to check (`/enriched`):** final grid **`ENRICHED_OBSERVATION_ROW`** (security + chosen workstream + descriptor columns).

### Limitations (negative space)

- Scores $s_{ij}$ are **not** claimed to be calibrated probabilities; interpreting them across securities or portfolios requires an explicit business definition.
- Hierarchy rules and overrides need governance (who can change patterns or wildcard precedence, and how conflicts are reviewed)—errors are operational, not mathematical.
- This repo does **not** reproduce production **scale** mechanics (indexed TVFs, staging on read replicas, etc.); those are described in `docs/case-study.md`.

## Repository layout

| Path | Purpose |
|------|--------|
| `docs/case-study.md` | Production / org narrative; ties original system to this repo’s **Aladdin-style FI** portfolio demo |
| `docs/images/enriched-output-simple.png` | Simplified screenshot of the **Enriched output** screen in the Next.js toy UI (`/enriched`) |
| `sql/postgres/demo.sql` | End-to-end **Aladdin-style FI** reference demo (PostgreSQL; synthetic ISINs) |
| `scripts/verify_postgres_demo.py` | Optional: parse-check `sql/postgres/demo.sql` with **pglast** (no Postgres server) |
| `scripts/run_postgres_demo_docker.ps1` | Optional: run the Postgres demo end-to-end in Docker (no local `psql`; Windows) |
| `scripts/run_postgres_demo_docker.sh` | Same as above for bash (macOS/Linux) |
| `web/` | Next.js toy UI: descriptor CRUD, enriched grid/CSV, **OpenAPI 3** (`public/openapi.yaml`) + **`/api-docs`** (Prisma/PostgreSQL) |

## Demo data model (Aladdin-style vendor + fund overrides, synthetic)

| Layer | Contents |
|-------|-----------|
| **Vendor reference (`ald_*`)** | Mimics platform hierarchy: `ald_issuer_class`, `ald_region`, `ald_rating_band` (values like sovereign / corporate, na / emea, ig / core). |
| **Fund semantic layer (`fund_*_override`)** | Nullable per column; when **non-blank**, replaces the corresponding `ald_*` for **scoring only** (vendor columns remain in the enriched output for lineage). |
| **Effective (implicit)** | `COALESCE(NULLIF(TRIM(override), ''), ald_value)` per dimension—this is what **kernelization** sees. |
| **Kernelized features** | Sparse 0/1 atoms over **effective** labels: `fi_sovereign`, `fi_corporate`, `region_emea`, `region_na`, `rating_ig`. |
| **Hierarchy enrichment rules** | User-maintained match rows with `*` wildcard support across `hierarchy_top`, `hierarchy_middle`, `hierarchy_bottom`, `hierarchy_level_04..07`; sparse kernel dot-product score is computed per rule and max-selected per outcome. |
| **Dimension enrichment rules** | Separate one-level rules (`dimension_name`, `dimension_value`) for non-hierarchy fields (e.g. vendor region grouping); applied independently so hierarchy model stays intact. |
| **Decision outcomes** | Workstreams: sovereign rates (NA), corporate credit (NA), corporate credit (EMEA). |
| **Deliverable** | **`ENRICHED_OBSERVATION_ROW`**: `ald_*`, `fund_*_override`, **`effective_*`**, sparse matrix-style scores, `winning_workstream`, wildcard-resolved semantic descriptors. |

## Worked example (Aladdin-style FI data + fund overrides)

The SQL loads **seven synthetic** fixed income rows: each has **vendor (`ald_*`)** reference attributes and optional **`fund_*_override`** values maintained by the fund (semantic layer). **Kernelization** uses **effective** = override when non-blank, else vendor. **ISINs are fabricated** (`…ALDIN…`). *Aladdin® is a registered trademark of BlackRock, Inc.; this repo is independent and for illustration only.*

Match the **`INSERT` into `demo_observations`** and **`ENRICHED_OBSERVATION_ROW`** to the tables below.

### Inputs: vendor hierarchy vs fund overrides

Illustrative layout: **Aladdin-classified** columns plus **fund** columns (same names as `demo_observations`). *Description / asset type / ccy* are **README-only** context.

| isin | illustrative name | asset type | **ald_issuer_class** | **fund_issuer_class_override** | **ald_region** | **fund_region_override** | **ald_rating_band** | **fund_rating_band_override** |
|------|-------------------|------------|----------------------|--------------------------------|----------------|---------------------------|---------------------|-------------------------------|
| US00ALDINFI01 | US Treasury note (synthetic) | Govt | sovereign | *(none)* | na | *(none)* | ig | *(none)* |
| DE00ALDINFI02 | EUR corporate note (synthetic) | Corp | corporate | *(none)* | emea | *(none)* | core | *(none)* |
| US00ALDINFI03 | US corporate bond (synthetic) | Corp | corporate | *(none)* | na | **`emea`** | core | *(none)* |
| GB00ALDINFI04 | UK gilt (synthetic) | Govt | sovereign | *(none)* | emea | *(none)* | ig | *(none)* |
| FR00ALDINFI05 | FR corporate note (synthetic) | Corp | corporate | *(none)* | emea | *(none)* | ig | **`core`** |
| CA00ALDINFI06 | CA corporate note (synthetic) | Corp | corporate | *(none)* | na | **`emea`** | core | *(none)* |
| US00ALDINFI07 | US FI derivative (synthetic) | Deriv | derivative | *(none)* | na | *(none)* | core | *(none)* |

**Row 3 story:** Aladdin still books the name in **North America** (`ald_region = na`), but the fund sets **`fund_region_override = emea`** so—**for internal aggregation and workstream routing**—it is treated like an **EMEA corporate** (e.g. to align with a sleeve or mandate view) **without editing the vendor feed**.

- **Effective for scoring:** rows 3 and 6 behave as **corporate + emea + core** → same feature vector as row 2 → **corporate credit (EMEA)** wins.
- **`rating_band` = `core`:** no `rating_ig` bit in this toy; not a literal Aladdin enum.

### Inputs: subject options (workstreams)

Each row is a candidate **downstream workstream**. `decision_code` is the key selected by **argmax**.

| decision_code (system key) | Aladdin-style workstream label |
|----------------------------|--------------------------------|
| `ald_sov_rates_na` | Sovereign & rates — North America |
| `ald_corp_credit_na` | Corporate credit — North America |
| `ald_corp_credit_emea` | Corporate credit — EMEA |

Experts maintain hierarchy rules with wildcard support. The engine kernelizes hierarchy rows and observations, computes sparse matrix-style scores, reshapes wide scores (`a`/`b`/`c`) to long, and applies argmax (tie-break on `rule_id`).

### Output: enriched rows (vendor + overrides + effective + winner)

**`ENRICHED_OBSERVATION_ROW`** mirrors SQL output: full `ald_*`/`fund_*`, computed `effective_*`, scores, winning workstream, hierarchy descriptors, and dimension descriptors.

| isin | ald_region | fund_region_override | effective_region | effective_issuer | effective_rating | score_a | score_b | score_c | winning_workstream | winning_score | descriptor_01 | descriptor_02 | descriptor_03 | descriptor_04 |
|------|------------|----------------------|------------------|------------------|------------------|---------|---------|---------|---------------------|---------------|---------------|---------------|---------------|---------------|
| US00ALDINFI01 | na | | na | sovereign | ig | 1.00 | 0.33 | 0.00 | `ald_sov_rates_na` | 1.00 | rates_coverage | SOV-RATES-NA | T+0_CLOSE | BOOK_NA_GOVT |
| DE00ALDINFI02 | emea | | emea | corporate | core | 0.00 | 0.33 | 1.00 | `ald_corp_credit_emea` | 1.00 | credit_coverage | CORP-CREDIT-EMEA | T+1_STD | BOOK_EMEA_CREDIT |
| US00ALDINFI03 | na | emea | **emea** | corporate | core | 0.00 | 0.33 | 1.00 | **`ald_corp_credit_emea`** | 1.00 | credit_coverage | **CORP-CREDIT-EMEA** | **T+1_STD** | **BOOK_EMEA_CREDIT** |
| GB00ALDINFI04 | emea | | emea | sovereign | ig | 1.00 | 0.33 | 0.00 | `ald_sov_rates_na` | 1.00 | rates_coverage | SOV-RATES-NA | T+0_CLOSE | BOOK_NA_GOVT |
| FR00ALDINFI05 | emea | | emea | corporate | core | 0.00 | 0.33 | 1.00 | `ald_corp_credit_emea` | 1.00 | credit_coverage | CORP-CREDIT-EMEA | T+1_STD | BOOK_EMEA_CREDIT |
| CA00ALDINFI06 | na | emea | **emea** | corporate | core | 0.00 | 0.33 | 1.00 | **`ald_corp_credit_emea`** | 1.00 | credit_coverage | **CORP-CREDIT-EMEA** | **T+1_STD** | **BOOK_EMEA_CREDIT** |
| US00ALDINFI07 | na | | na | derivative | core | 0.00 | 0.33 | 0.00 | `ald_corp_credit_na` | 0.33 | general_debt_coverage | CORP-CREDIT-NA | T+1_STD | BOOK_NA_CREDIT |

**Readout:** Sovereign rows align to the exact sovereign hierarchy rule and get `descriptor_01 = rates_coverage`; corporate rows align to the exact corporate rule and get `credit_coverage`; derivative row 7 falls through to the wildcard fallback (`Debt` + `*` + `*`) and gets `general_debt_coverage`. Rows 3 and 6 show the Aladdin-vs-fund tension directly: vendor region is **NA**, fund override rebooks to **EMEA**, and decisioning follows **effective** values without mutating the vendor feed. Hierarchy descriptors and independent dimension descriptors are both attached to the same enriched row.

## Quick start (PostgreSQL)

```bash
# From repo root — Aladdin-style FI demo (synthetic ISINs); adjust connection flags
psql -U postgres -d postgres -f sql/postgres/demo.sql
```

After a successful run, **`demo_*` tables remain** in the database so you can run your own `SELECT`s; re-running the script replaces them.

### Without local `psql` (Docker)

If you have **Docker** but no PostgreSQL client on the host, run the same script inside an ephemeral server (pulls `postgres:16-alpine` on first use):

```powershell
# Windows (PowerShell), from repo root
.\scripts\run_postgres_demo_docker.ps1
```

```bash
# macOS / Linux (bash), from repo root
bash scripts/run_postgres_demo_docker.sh
```

Use a different image tag if needed: `.\scripts\run_postgres_demo_docker.ps1 -PostgresImage postgres:17-alpine` (PowerShell) or `POSTGRES_IMAGE=postgres:17-alpine bash scripts/run_postgres_demo_docker.sh` (bash).

Opening `README.md` in a browser as a file usually shows **plain text**. Use your editor’s Markdown preview, or view the repo on **GitHub**, where the home-page README is rendered (including math).

## After you create a GitHub remote

```bash
cd single-neuron-semantic-layer
git init
git add .
git commit -m "Initial commit: case study and synthetic SQL demos"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

If you **already created an empty repo on GitHub**, clone it into this folder’s parent and copy these files in, or add `origin` as above.

**Git author:** If the first commit used placeholder `user.name` / `user.email` (local to this repo only), set your real identity and fix the author:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
git commit --amend --reset-author --no-edit
```

## Future enhancements

**SQL performance (from the [original article](https://dispassionatedeveloper.blogspot.com/2020/04/building-sql-based-expert-system-for.html), as they apply to this pattern).** The portfolio scripts are intentionally small and pedagogical; at production scale the same pipeline would benefit from the tactics called out there and summarized in `docs/case-study.md`:

- **Shrink work early:** expose enrichment through **selective entry points** (e.g. table-valued functions or contracts that **require keys / filters**) so the optimizer can use **indexes** on large observation tables instead of scoring every row on every call.
- **Lighten hot paths:** prefer **pre-kernelized numeric or binary** features over heavy string logic where possible, and keep **`UNPIVOT` / wide-score column identifiers short** to cut string comparison cost in tight loops.
- **Stage and index intermediates:** **materialized or temp staging** with appropriate **indexes** on intermediate results often beats a single monolithic **CTE-only** shape when predicates do not push down cleanly—see also the README **Limitations** note on indexed TVFs and replicas.

**Historical enrichments.** Production runs should record which enrichment snapshot was used when a row was scored—e.g. hierarchy-rule version set, override state, and pipeline build—so past routing decisions remain explainable after rule edits.

## Tags

Expert system, semantic layer, kernelization of categorical data, linear layer / argmax analogy, classification override, vendor vs fund taxonomy, fixed income reference data, rules engine, decision automation, linear scoring, SQL (PostgreSQL), data engineering, in-database enrichment, portfolio / interview artifact.

## License

Content and demo SQL are provided for portfolio use; adapt as you see fit. **Demo securities and Aladdin-style naming are illustrative only** and imply no relationship to BlackRock or to any live instrument or data product.
