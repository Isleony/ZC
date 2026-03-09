CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS incidents (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('tiroteio','roubo','homicidio','furto','violencia_domestica')),
    occurred_at TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL,
    confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    severity_weight NUMERIC(3,2) NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'confirmado',
    region TEXT NOT NULL,
    geom GEOGRAPHY(POINT, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS incidents_geom_idx ON incidents USING GIST (geom);
CREATE INDEX IF NOT EXISTS incidents_time_idx ON incidents (occurred_at DESC);
