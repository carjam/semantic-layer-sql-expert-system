/*
  Synthetic demo: kernelization + variable space / subject space + rule scoring.
  T-SQL; temp tables. Fictional support tickets.

  Variable space: each observation is a vector in R^M (rows of D).
  Subject space: each feature is a vector over observations (transpose of D).
  Kernelization: qualitative tier/region/priority -> sparse 0/1 features in R^M.

  NN analogy: K is a linear map R^M -> R^N (logit-like scores, no activation);
  argmax over scores is a hard max / winner-take-all gate (plus tie-break).

  Final step: wide score columns (a,b,c) -> UNPIVOT -> argmax -> join raw obs +
  user-maintained decision descriptors (row-shaped enriched output).
*/

SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#features') IS NOT NULL DROP TABLE #features;
IF OBJECT_ID('tempdb..#rules') IS NOT NULL DROP TABLE #rules;
IF OBJECT_ID('tempdb..#rule_enrichment') IS NOT NULL DROP TABLE #rule_enrichment;
IF OBJECT_ID('tempdb..#rule_weights') IS NOT NULL DROP TABLE #rule_weights;
IF OBJECT_ID('tempdb..#observations') IS NOT NULL DROP TABLE #observations;
IF OBJECT_ID('tempdb..#observation_features') IS NOT NULL DROP TABLE #observation_features;

CREATE TABLE #features (
  feature_id    SMALLINT NOT NULL PRIMARY KEY,
  feature_code  VARCHAR(32) NOT NULL
);

CREATE TABLE #rules (
  rule_id         SMALLINT NOT NULL PRIMARY KEY,
  decision_code   VARCHAR(32) NOT NULL
);

CREATE TABLE #rule_enrichment (
  rule_id        SMALLINT NOT NULL PRIMARY KEY,
  routing_queue  VARCHAR(32) NOT NULL,
  sla_bucket     VARCHAR(8) NOT NULL,
  cost_center    VARCHAR(16) NOT NULL
);

CREATE TABLE #rule_weights (
  rule_id    SMALLINT NOT NULL,
  feature_id SMALLINT NOT NULL,
  weight     DECIMAL(6, 5) NOT NULL,
  PRIMARY KEY (rule_id, feature_id)
);

CREATE TABLE #observations (
  observation_id INT NOT NULL PRIMARY KEY,
  ticket_ref     VARCHAR(16) NOT NULL,
  tier           VARCHAR(16) NOT NULL,
  region         VARCHAR(16) NOT NULL,
  priority       VARCHAR(16) NOT NULL
);

CREATE TABLE #observation_features (
  observation_id INT NOT NULL,
  feature_id     SMALLINT NOT NULL,
  PRIMARY KEY (observation_id, feature_id)
);

INSERT INTO #features (feature_id, feature_code) VALUES
  (1, 'tier_enterprise'), (2, 'tier_standard'),
  (3, 'region_emea'), (4, 'region_na'), (5, 'priority_high');

INSERT INTO #rules (rule_id, decision_code) VALUES
  (1, 'team_platform'), (2, 'team_regional_na'), (3, 'team_regional_emea');

INSERT INTO #rule_enrichment (rule_id, routing_queue, sla_bucket, cost_center) VALUES
  (1, 'PLAT-CRITICAL', 'P1', 'CC-900'),
  (2, 'NA-GENERAL',  'P3', 'CC-100'),
  (3, 'EMEA-GENERAL','P3', 'CC-200');

INSERT INTO #rule_weights (rule_id, feature_id, weight) VALUES
  (1, 1, 0.50), (1, 5, 0.50),
  (2, 2, 0.40), (2, 4, 0.60),
  (3, 2, 0.40), (3, 3, 0.60);

INSERT INTO #observations (observation_id, ticket_ref, tier, region, priority) VALUES
  (1, 'TK-1001', 'enterprise', 'na',   'high'),
  (2, 'TK-1002', 'standard',   'emea', 'normal'),
  (3, 'TK-1003', 'standard',   'na',   'normal');

/* --- Kernelization: qualitative -> binary coordinates in R^M --- */
INSERT INTO #observation_features (observation_id, feature_id)
SELECT o.observation_id, v.feature_id
FROM #observations o
CROSS APPLY (
  VALUES
    (CASE WHEN o.tier = 'enterprise' THEN 1 END),
    (CASE WHEN o.tier = 'standard'  THEN 2 END),
    (CASE WHEN o.region = 'emea' THEN 3 END),
    (CASE WHEN o.region = 'na'   THEN 4 END),
    (CASE WHEN o.priority = 'high' THEN 5 END)
) AS v(feature_id)
WHERE v.feature_id IS NOT NULL;

/* --- Variable space: rows of D (observation vectors) --- */
SELECT
  'VARIABLE_SPACE_D_MATRIX' AS section,
  o.observation_id,
  o.ticket_ref,
  CAST(MAX(CASE WHEN ofe.feature_id = 1 THEN 1 ELSE 0 END) AS TINYINT) AS f_tier_enterprise,
  CAST(MAX(CASE WHEN ofe.feature_id = 2 THEN 1 ELSE 0 END) AS TINYINT) AS f_tier_standard,
  CAST(MAX(CASE WHEN ofe.feature_id = 3 THEN 1 ELSE 0 END) AS TINYINT) AS f_region_emea,
  CAST(MAX(CASE WHEN ofe.feature_id = 4 THEN 1 ELSE 0 END) AS TINYINT) AS f_region_na,
  CAST(MAX(CASE WHEN ofe.feature_id = 5 THEN 1 ELSE 0 END) AS TINYINT) AS f_priority_high
FROM #observations o
LEFT JOIN #observation_features ofe ON ofe.observation_id = o.observation_id
GROUP BY o.observation_id, o.ticket_ref
ORDER BY o.observation_id;

/* --- Variable space: rows of K (same M axes, weights) --- */
SELECT
  'VARIABLE_SPACE_K_ROWS' AS section,
  r.rule_id,
  r.decision_code,
  ISNULL(MAX(CASE WHEN rw.feature_id = 1 THEN rw.weight END), 0) AS w_tier_enterprise,
  ISNULL(MAX(CASE WHEN rw.feature_id = 2 THEN rw.weight END), 0) AS w_tier_standard,
  ISNULL(MAX(CASE WHEN rw.feature_id = 3 THEN rw.weight END), 0) AS w_region_emea,
  ISNULL(MAX(CASE WHEN rw.feature_id = 4 THEN rw.weight END), 0) AS w_region_na,
  ISNULL(MAX(CASE WHEN rw.feature_id = 5 THEN rw.weight END), 0) AS w_priority_high,
  SUM(rw.weight) AS row_weight_sum
FROM #rules r
INNER JOIN #rule_weights rw ON rw.rule_id = r.rule_id
GROUP BY r.rule_id, r.decision_code
ORDER BY r.rule_id;

/* --- Subject space: feature vectors over tickets (transpose of D) --- */
SELECT
  'SUBJECT_SPACE_BY_TICKET' AS section,
  fe.feature_code,
  CAST(ISNULL(MAX(CASE WHEN o.ticket_ref = 'TK-1001' THEN 1 END), 0) AS TINYINT) AS tk1001,
  CAST(ISNULL(MAX(CASE WHEN o.ticket_ref = 'TK-1002' THEN 1 END), 0) AS TINYINT) AS tk1002,
  CAST(ISNULL(MAX(CASE WHEN o.ticket_ref = 'TK-1003' THEN 1 END), 0) AS TINYINT) AS tk1003
FROM #features fe
LEFT JOIN #observation_features ofe ON ofe.feature_id = fe.feature_id
LEFT JOIN #observations o ON o.observation_id = ofe.observation_id
GROUP BY fe.feature_id, fe.feature_code
ORDER BY fe.feature_id;

/* --- Linear layer: pre-max scores (sparse <k_i, d_j>) --- */
;WITH scores AS (
  SELECT
    o.observation_id,
    o.ticket_ref,
    r.rule_id,
    r.decision_code,
    SUM(rw.weight) AS score
  FROM #observations o
  INNER JOIN #observation_features ofe ON ofe.observation_id = o.observation_id
  INNER JOIN #rule_weights rw ON rw.feature_id = ofe.feature_id
  INNER JOIN #rules r ON r.rule_id = rw.rule_id
  GROUP BY o.observation_id, o.ticket_ref, r.rule_id, r.decision_code
)
SELECT
  'LINEAR_LAYER_SCORES' AS section,
  observation_id,
  ticket_ref,
  rule_id,
  decision_code,
  score AS pre_max_score
FROM scores
ORDER BY observation_id, rule_id;

/* --- Argmax gate: one winning outcome per observation --- */
;WITH scores AS (
  SELECT
    o.observation_id,
    o.ticket_ref,
    r.rule_id,
    r.decision_code,
    SUM(rw.weight) AS score
  FROM #observations o
  INNER JOIN #observation_features ofe ON ofe.observation_id = o.observation_id
  INNER JOIN #rule_weights rw ON rw.feature_id = ofe.feature_id
  INNER JOIN #rules r ON r.rule_id = rw.rule_id
  GROUP BY o.observation_id, o.ticket_ref, r.rule_id, r.decision_code
),
ranked AS (
  SELECT
    s.*,
    ROW_NUMBER() OVER (PARTITION BY s.observation_id ORDER BY s.score DESC, s.rule_id) AS rn
  FROM scores s
)
SELECT
  'ARGMAX_GATE' AS section,
  observation_id,
  ticket_ref,
  decision_code AS winning_team,
  score AS winning_score
FROM ranked
WHERE rn = 1
ORDER BY observation_id;

/* --- UNPIVOT long scores (a,b,c = minimal column ids per blog) -> argmax -> enriched row --- */
;WITH dense_scores AS (
  SELECT
    o.observation_id,
    o.ticket_ref,
    r.rule_id,
    ISNULL(SUM(rw.weight), 0) AS score
  FROM #observations o
  CROSS JOIN #rules r
  LEFT JOIN #observation_features ofe ON ofe.observation_id = o.observation_id
  LEFT JOIN #rule_weights rw
    ON rw.rule_id = r.rule_id
   AND rw.feature_id = ofe.feature_id
  GROUP BY o.observation_id, o.ticket_ref, r.rule_id
),
wide AS (
  SELECT
    observation_id,
    ticket_ref,
    MAX(CASE WHEN rule_id = 1 THEN score END) AS a,
    MAX(CASE WHEN rule_id = 2 THEN score END) AS b,
    MAX(CASE WHEN rule_id = 3 THEN score END) AS c
  FROM dense_scores
  GROUP BY observation_id, ticket_ref
),
unpivoted AS (
  SELECT
    u.observation_id,
    u.ticket_ref,
    u.decision_slot,
    CASE u.decision_slot
      WHEN 'a' THEN CAST(1 AS SMALLINT)
      WHEN 'b' THEN CAST(2 AS SMALLINT)
      WHEN 'c' THEN CAST(3 AS SMALLINT)
    END AS rule_id,
    u.pre_max_score
  FROM wide w
  UNPIVOT (pre_max_score FOR decision_slot IN (a, b, c)) AS u
)
SELECT
  'UNPIVOT_LONG' AS section,
  observation_id,
  ticket_ref,
  decision_slot,
  rule_id,
  pre_max_score
FROM unpivoted
ORDER BY observation_id, decision_slot;

;WITH dense_scores AS (
  SELECT
    o.observation_id,
    o.ticket_ref,
    r.rule_id,
    ISNULL(SUM(rw.weight), 0) AS score
  FROM #observations o
  CROSS JOIN #rules r
  LEFT JOIN #observation_features ofe ON ofe.observation_id = o.observation_id
  LEFT JOIN #rule_weights rw
    ON rw.rule_id = r.rule_id
   AND rw.feature_id = ofe.feature_id
  GROUP BY o.observation_id, o.ticket_ref, r.rule_id
),
wide AS (
  SELECT
    observation_id,
    ticket_ref,
    MAX(CASE WHEN rule_id = 1 THEN score END) AS a,
    MAX(CASE WHEN rule_id = 2 THEN score END) AS b,
    MAX(CASE WHEN rule_id = 3 THEN score END) AS c
  FROM dense_scores
  GROUP BY observation_id, ticket_ref
),
unpivoted AS (
  SELECT
    u.observation_id,
    u.ticket_ref,
    CASE u.decision_slot
      WHEN 'a' THEN CAST(1 AS SMALLINT)
      WHEN 'b' THEN CAST(2 AS SMALLINT)
      WHEN 'c' THEN CAST(3 AS SMALLINT)
    END AS rule_id,
    u.pre_max_score
  FROM wide w
  UNPIVOT (pre_max_score FOR decision_slot IN (a, b, c)) AS u
),
ranked AS (
  SELECT
    p.*,
    ROW_NUMBER() OVER (PARTITION BY p.observation_id ORDER BY p.pre_max_score DESC, p.rule_id) AS rn
  FROM unpivoted p
)
SELECT
  'ENRICHED_OBSERVATION_ROW' AS section,
  o.observation_id,
  o.ticket_ref,
  o.tier,
  o.region,
  o.priority,
  w.a AS score_a,
  w.b AS score_b,
  w.c AS score_c,
  r.decision_code AS winning_team,
  win.pre_max_score AS winning_score,
  e.routing_queue,
  e.sla_bucket,
  e.cost_center
FROM #observations o
INNER JOIN wide w ON w.observation_id = o.observation_id
INNER JOIN ranked win ON win.observation_id = o.observation_id AND win.rn = 1
INNER JOIN #rules r ON r.rule_id = win.rule_id
INNER JOIN #rule_enrichment e ON e.rule_id = win.rule_id
ORDER BY o.observation_id;
