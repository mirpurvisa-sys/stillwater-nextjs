-- Run once in your Supabase SQL Editor before accepting live submissions.
-- Dedicated schema is intentionally not exposed through the browser Data API.
CREATE SCHEMA IF NOT EXISTS stillwater;
REVOKE ALL ON SCHEMA stillwater FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS stillwater.records (
 id text PRIMARY KEY, kind text NOT NULL, case_id text NOT NULL DEFAULT '',
 data text NOT NULL CHECK (jsonb_typeof(data::jsonb)='object'), updated text NOT NULL
);
CREATE INDEX IF NOT EXISTS records_kind_idx ON stillwater.records(kind);
CREATE INDEX IF NOT EXISTS records_case_idx ON stillwater.records(case_id);
CREATE TABLE IF NOT EXISTS stillwater.members (
 id text PRIMARY KEY, email text NOT NULL UNIQUE,
 role text NOT NULL CHECK (role IN ('admin','coordinator','finance','family','disabled')),
 case_id text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS stillwater.grants (
 email text PRIMARY KEY,
 role text NOT NULL CHECK (role IN ('coordinator','finance','family','disabled')),
 case_id text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS stillwater.audit (
 id text PRIMARY KEY, actor text NOT NULL, action text NOT NULL, record_id text NOT NULL, date text NOT NULL
);
CREATE TABLE IF NOT EXISTS stillwater.files (
 id text PRIMARY KEY, case_id text NOT NULL, name text NOT NULL, mime text NOT NULL, owner text NOT NULL
);
REVOKE ALL ON ALL TABLES IN SCHEMA stillwater FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA stillwater REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
-- Private bucket: no browser upload/download policies are granted.
-- All file access passes through Next.js, which checks the member and case.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('stillwater-private','stillwater-private',false,4194304,
 ARRAY['image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/wav','video/mp4'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=4194304,
 allowed_mime_types=EXCLUDED.allowed_mime_types;
