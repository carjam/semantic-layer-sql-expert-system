/*
  Synthetic demo: rule matrix x observation features -> scores -> winner
  T-SQL flavor (closer to original SQL Server context). Fictional domain.
  Run in ssms or sqlcmd; uses temp tables and rolls back implicitly when session ends.
*/

SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#features') IS NOT NULL DROP TABLE #features;
IF OBJECT_ID('tempdb..#rules') IS NOT NULL DROP TABLE #rules;
IF OBJECT_ID('tempdb..#rule_weights') IS NOT NULL DROP TABLE #rule_weights;
IF OBJECT_ID('tempdb..#observations') IS NOT NULL DROP TABLE #observations;
IF OBJECT_ID('tempdb..#observation_features') IS NOT NULL DROP TABLE #observation_features;

CREATE TABLE #features (
  feature_id   SMALLINT NOT NULL PRIMARY KEY,
  feature_code VARCHAR(32) NOT NULL
);

CREATE TABLE #rules (
  rule_id       SMALLINT NOT NULL PRIMARY KEY,
  decision_code VARCHAR(32) NOT NULL
);

CREATE TABLE #rule_weights (
  rule_id    SMALLINT NOT NULL,
  feature_id SMALLINT NOT NULL,
  weight     DECIMAL(6, 5) NOT NULL,
  PRIMARY KEY (rule_id, feature_id)
);

CREATE TABLE #observations (
  observation_id INT NOT NULL PRIMARY KEY,
  ticket_ref     VARCHAR(16) NOT NULL
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

INSERT INTO #rule_weights (rule_id, feature_id, weight) VALUES
  (1, 1, 0.50), (1, 5, 0.50),
  (2, 2, 0.40), (2, 4, 0.60),
  (3, 2, 0.40), (3, 3, 0.60);

INSERT INTO #observations (observation_id, ticket_ref) VALUES
  (1, 'TK-1001'), (2, 'TK-1002'), (3, 'TK-1003');

INSERT INTO #observation_features (observation_id, feature_id) VALUES
  (1, 1), (1, 4), (1, 5),
  (2, 2), (2, 3),
  (3, 2), (3, 4);

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
SELECT observation_id, ticket_ref, decision_code AS winning_team, score
FROM ranked
WHERE rn = 1
ORDER BY observation_id;
