# Semantic layer + SQL expert system (portfolio)

This repository is a **public, synthetic** companion to a production system I designed and built at a former employer. It documents the architecture and tradeoffs and includes a **small runnable SQL demo**: **kernelization** of qualitative fields into sparse binary features, **variable space** ($D$ and $K$ as rows in shared $\mathbb{R}^M$), **subject space** (transpose: features × observations), a **linear score layer** (logits-shaped), **wide scores → `UNPIVOT`** (T-SQL) or **`LATERAL VALUES`** (PostgreSQL, same long shape), **argmax** gating, and **`ENRICHED_OBSERVATION_ROW`**: one row per observation marrying the raw feed with the chosen decision and **semantic-layer** descriptors (`routing_queue`, `sla_bucket`, `cost_center`).

**Original write-up (2019 context, published 2020):** [Building a Semantic Layer Using AI](https://dispassionatedeveloper.blogspot.com/2020/04/building-sql-based-expert-system-for.html)

## What this repo is for

- **Interview narrative:** Problem, constraints, design, and lessons in one place (`docs/case-study.md`).
- **Technical proof of familiarity:** You can run the demo locally and step through the SQL.
- **Not a reproduction:** No proprietary schemas, data, or code from the employer.

## Repository layout

| Path | Purpose |
|------|--------|
| `docs/case-study.md` | Case study: context, design, performance, integrations |
| `sql/postgres/demo.sql` | End-to-end toy example (PostgreSQL) |
| `sql/sqlserver/demo.sql` | Same idea, T-SQL flavored (closer to the original post) |

## Worked example (what the demo is doing)

The script uses a **fictional support-routing** domain. You can read the **inputs** in the `INSERT` statements, run the file, and match the last result set **`ENRICHED_OBSERVATION_ROW`** to the tables below.

### Inputs: observations (raw qualitative feed)

These rows are the **observations**—what might arrive from an upstream feed **before** any routing metadata exists:

| ticket_ref | tier       | region | priority |
|------------|------------|--------|----------|
| TK-1001    | enterprise | na     | high     |
| TK-1002    | standard   | emea   | normal   |
| TK-1003    | standard   | na     | normal   |

### Inputs: subject options (decisions + semantic descriptors)

Each **subject option** is a possible routing outcome (`decision_code`) plus **user-maintained** descriptor columns (queues, SLA, cost center), analogous to the “white” semantic columns in the original UI:

| decision_code        | routing_queue   | sla_bucket | cost_center |
|----------------------|-----------------|------------|-------------|
| team_platform        | PLAT-CRITICAL   | P1         | CC-900      |
| team_regional_na     | NA-GENERAL      | P3         | CC-100      |
| team_regional_emea   | EMEA-GENERAL    | P3         | CC-200      |

Experts also define **weights** over shared **atomic features** (e.g. `tier_enterprise`, `region_na`) so each team gets a numeric score against every ticket. The demo **kernelizes** the text columns into those binary features before scoring.

### Output: observations enriched with the best subject’s descriptors

The pipeline scores **every observation against every rule** (zeros when there is no feature overlap), takes **argmax**, then joins the **winning** row’s descriptors. Result set **`ENRICHED_OBSERVATION_ROW`** is **one row per ticket** with raw fields, wide scores for rules 1–3 (`score_a`, `score_b`, `score_c`), the winner, and the chosen descriptors:

| ticket_ref | tier       | region | priority | score_a | score_b | score_c | winning_team           | winning_score | routing_queue   | sla_bucket | cost_center |
|------------|------------|--------|----------|---------|---------|---------|------------------------|---------------|-----------------|------------|-------------|
| TK-1001    | enterprise | na     | high     | 1.00    | 0.60    | 0.00    | team_platform          | 1.00          | PLAT-CRITICAL   | P1         | CC-900      |
| TK-1002    | standard   | emea   | normal   | 0.00    | 0.40    | 1.00    | team_regional_emea     | 1.00          | EMEA-GENERAL    | P3         | CC-200      |
| TK-1003    | standard   | na     | normal   | 0.00    | 1.00    | 0.40    | team_regional_na       | 1.00          | NA-GENERAL      | P3         | CC-100      |

In short: **TK-1001** (enterprise, NA, high) goes to **platform** and picks up **PLAT-CRITICAL / P1 / CC-900**; **TK-1002** (standard, EMEA) goes to **EMEA-GENERAL**; **TK-1003** (standard, NA) goes to **NA-GENERAL**. Earlier result sets in the same script (`VARIABLE_SPACE_*`, `UNPIVOT_LONG`, etc.) show the geometry and the UNPIVOT step; this table is the **consumer-shaped** outcome.

## Quick start (PostgreSQL)

```bash
# From repo root — adjust connection flags for your environment
psql -U postgres -d postgres -f sql/postgres/demo.sql
```

## Quick start (SQL Server)

```bash
sqlcmd -S . -d master -i sql/sqlserver/demo.sql
```

## After you create a GitHub remote

```bash
cd semantic-layer-sql-expert-system
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

## License

Content and demo SQL are provided for portfolio use; adapt as you see fit.
