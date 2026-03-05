-- =============================================================
-- Supabase migration: Alert generation for watched items
-- =============================================================
-- Provides a server-side function that creates data_alerts for
-- every user watching a given item. Intended to be called from
-- the FastAPI backend or a Supabase Edge Function whenever
-- relevant data changes (e.g., new audit report, budget update).
-- =============================================================

-- Allow service-role inserts into data_alerts (backend writes)
create policy "Service role can insert alerts"
  on public.data_alerts for insert
  with check (true);

-- ─── notify_watchers() ──────────────────────────────────────
-- Call this function when data changes to fan out alerts to
-- every user watching the affected item.
--
-- Parameters:
--   p_item_type   – 'county' | 'national_category' | 'budget_programme'
--   p_item_id     – the ID of the changed item
--   p_alert_type  – e.g. 'data_update', 'new_audit', 'budget_change'
--   p_title       – short alert headline
--   p_body        – longer description (optional)
-- =============================================================
create or replace function public.notify_watchers(
  p_item_type text,
  p_item_id   text,
  p_alert_type text,
  p_title     text,
  p_body      text default null
)
returns int  -- number of alerts created
language plpgsql
security definer set search_path = ''
as $$
declare
  v_count int := 0;
begin
  insert into public.data_alerts (user_id, alert_type, title, body, item_type, item_id)
  select
    w.user_id,
    p_alert_type,
    p_title,
    coalesce(p_body, ''),
    p_item_type,
    p_item_id
  from public.watchlist_items w
  where w.item_type = p_item_type
    and w.item_id   = p_item_id
    and w.notify     = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Grant execute to the service_role so the backend can call it
grant execute on function public.notify_watchers(text, text, text, text, text)
  to service_role;


-- ─── Convenience: auto-alert on watchlist subscribe ─────────
-- Sends a welcome alert when a user adds an item to their watchlist
create or replace function public.on_watchlist_insert()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.data_alerts (user_id, alert_type, title, body, item_type, item_id)
  values (
    new.user_id,
    'watch_started',
    'Now watching: ' || new.label,
    'You will receive alerts when data changes for this item.',
    new.item_type,
    new.item_id
  );
  return new;
end;
$$;

create trigger watchlist_welcome_alert
  after insert on public.watchlist_items
  for each row execute function public.on_watchlist_insert();
