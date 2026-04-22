#!/usr/bin/env bash
#
# 01_dump.sh — export data + schema from the OLD Supabase project.
#
# Produces three files in ./dumps/:
#   public.sql    — all application tables in the `public` schema
#   auth.sql      — user rows (auth.users + auth.identities + auth.mfa_*)
#   sequences.sql — post-restore `setval()` statements so Postgres
#                   sequences do not clash with migrated IDs.
#
# Prereqs: `pg_dump` and `psql` on PATH. OLD_DB must be exported (see
# README for the exact connection-string format).

set -euo pipefail

: "${OLD_DB:?Set OLD_DB to the OLD project session-pooler URI (port 5432)}"

cd "$(dirname "$0")"
mkdir -p dumps

echo "▶ Dumping public schema from OLD project…"
pg_dump "$OLD_DB" \
  --schema=public \
  --no-owner --no-privileges --no-publications --no-subscriptions \
  --no-comments \
  --file=dumps/public.sql
echo "  $(wc -l < dumps/public.sql) lines written to dumps/public.sql"

echo
echo "▶ Dumping auth schema (data only) so existing users keep their passwords…"
# Supabase owns the auth schema objects, so we dump DATA ONLY and restore
# into the auth schema that already exists in the target project.
pg_dump "$OLD_DB" \
  --data-only \
  --table=auth.users \
  --table=auth.identities \
  --table=auth.mfa_factors \
  --table=auth.mfa_challenges \
  --table=auth.mfa_amr_claims \
  --no-owner --no-privileges --no-comments \
  --file=dumps/auth.sql
echo "  $(wc -l < dumps/auth.sql) lines written to dumps/auth.sql"

echo
echo "▶ Generating sequence-reset SQL…"
# After restoring via pg_dump --data (COPY), sequences are behind max(id).
psql "$OLD_DB" -Atq -o dumps/sequences.sql -f _gen_sequences.sql
echo "  $(wc -l < dumps/sequences.sql) setval() statements"

echo
echo "✅ Dump complete. Files in ./dumps/:"
ls -lh dumps/
