#!/usr/bin/env bash
#
# 02_restore.sh — load the dumps into the NEW Supabase project.
#
# Not idempotent — reruns will error on duplicate primary keys, which is
# what you want (do not silently double-insert). If you need to re-run,
# drop + recreate the `public` schema on the new project first.

set -euo pipefail

: "${NEW_DB:?Set NEW_DB to the NEW project session-pooler URI (port 5432)}"

cd "$(dirname "$0")"

if [[ ! -f dumps/public.sql || ! -f dumps/auth.sql || ! -f dumps/sequences.sql ]]; then
  echo "❌ dumps/ missing files — run 01_dump.sh first."
  exit 1
fi

echo "▶ Ensuring extensions exist on NEW project…"
# Supabase projects come with these pre-installed, but belt-and-braces.
psql "$NEW_DB" --set ON_ERROR_STOP=on -f _ensure_extensions.sql

echo
echo "▶ Restoring public schema (tables, indexes, data)…"
psql "$NEW_DB" --set ON_ERROR_STOP=on -f dumps/public.sql > /tmp/restore_public.log 2>&1
echo "  done (log: /tmp/restore_public.log)"

echo
echo "▶ Restoring auth data (users + identities + mfa)…"
# auth.* tables already exist in the new project; we only add row data.
psql "$NEW_DB" --set ON_ERROR_STOP=on -f dumps/auth.sql > /tmp/restore_auth.log 2>&1
echo "  done (log: /tmp/restore_auth.log)"

echo
echo "▶ Resetting sequences so future inserts do not clash with migrated IDs…"
psql "$NEW_DB" --set ON_ERROR_STOP=on -f dumps/sequences.sql > /tmp/restore_sequences.log 2>&1
echo "  done"

echo
echo "✅ Restore complete. Run ./03_verify.sh to confirm row counts match."
