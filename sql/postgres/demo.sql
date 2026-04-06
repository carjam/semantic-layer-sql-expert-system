-- Synthetic demo: rule matrix x observation features -> scores -> winner
-- Domain is fictional (support routing). PostgreSQL.

BEGIN;

DROP TABLE IF EXISTS demo_observation_features;
DROP TABLE IF EXISTS demo_rule_weights;
DROP TABLE IF EXISTS demo_rules;
DROP TABLE IF EXISTS demo_features;
DROP TABLE IF EXISTS demo_observations;

CREATE TABLE demo_features (
  feature_id   SMALLINT PRIMARY KEY,
  feature_code TEXT NOT NULL UNIQUE
);

CREATE TABLE demo_rules (
  rule_id        SMALLINT PRIMARY KEY,
  decision_code  TEXT NOT NULL UNIQUE
);

-- Rows sum to 1.0 per rule_id (normalized weights).
CREATE TABLE demo_rule_weights (
  rule_id    SMALLINT NOT NULL REFERENCES demo_rules (rule_id),
  feature_id SMALLINT NOT NULL REFERENCES demo_features (feature_id),
  weight     NUMERIC(6, 5) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  PRIMARY KEY (rule_id, feature_id)
);

CREATE TABLE demo_observations (
  observation_id BIGSERIAL PRIMARY KEY,
  ticket_ref     TEXT NOT NULL
);

-- Sparse 0/1 features per observation (present = 1).
CREATE TABLE demo_observation_features (
  observation_id BIGINT NOT NULL REFERENCES demo_observations (observation_id),
  feature_id     SMALLINT NOT NULL REFERENCES demo_features (feature_id),
  PRIMARY KEY (observation_id, feature_id)
);

INSERT INTO demo_features (feature_id, feature_code) VALUES
  (1, 'tier_enterprise'),
  (2, 'tier_standard'),
  (3, 'region_emea'),
  (4, 'region_na'),
  (5, 'priority_high');

INSERT INTO demo_rules (rule_id, decision_code) VALUES
  (1, 'team_platform'),
  (2, 'team_regional_na'),
  (3, 'team_regional_emea');

INSERT INTO demo_rule_weights (rule_id, feature_id, weight) VALUES
  (1, 1, 0.50), (1, 5, 0.50),
  (2, 2, 0.40), (2, 4, 0.60),
  (3, 2, 0.40), (3, 3, 0.60);

INSERT INTO demo_observations (ticket_ref) VALUES
  ('TK-1001'), ('TK-1002'), ('TK-1003');

INSERT INTO demo_observation_features (observation_id, feature_id)
SELECT o.observation_id, f.feature_id
FROM demo_observations o
CROSS JOIN LATERAL (VALUES
  ('TK-1001', ARRAY[1, 4, 5]),
  ('TK-1002', ARRAY[2, 3]),
  ('TK-1003', ARRAY[2, 4])
) AS v(ref, feats)
JOIN demo_features f ON f.feature_id = ANY (v.feats)
WHERE o.ticket_ref = v.ref;

-- Scores: sum(weight) for features present on the observation.
WITH scores AS (
  SELECT
    o.observation_id,
    o.ticket_ref,
    r.rule_id,
    r.decision_code,
    SUM(rw.weight) AS score
  FROM demo_observations o
  JOIN demo_observation_features ofe ON ofe.observation_id = o.observation_id
  JOIN demo_rule_weights rw ON rw.feature_id = ofe.feature_id
  JOIN demo_rules r ON r.rule_id = rw.rule_id
  GROUP BY o.observation_id, o.ticket_ref, r.rule_id, r.decision_code
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY observation_id ORDER BY score DESC, rule_id) AS rn
  FROM scores
)
SELECT observation_id, ticket_ref, decision_code AS winning_team, score
FROM ranked
WHERE rn = 1
ORDER BY observation_id;

ROLLBACK;
