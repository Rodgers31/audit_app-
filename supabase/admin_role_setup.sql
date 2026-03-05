-- ============================================================
-- Admin Role Infrastructure for AuditGava
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- The profiles table already has a `roles` column (text[]).
-- New users automatically get ['citizen'] via the signup trigger.
--
-- This script:
--   1. Creates a helper function to check admin status (usable in RLS)
--   2. Shows how to grant/revoke admin role
-- ============================================================

-- ─── 1. Helper function: is_admin(user_id) ──────────────────
-- Useful in RLS policies and server-side checks
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND 'admin' = ANY(roles)
  );
$$;

-- ─── 2. Grant admin to a specific user (by email) ───────────
-- Replace the email below with the actual admin email
-- UPDATE public.profiles
-- SET roles = array_append(roles, 'admin')
-- WHERE email = 'otienor986@gmail.com'
--   AND NOT ('admin' = ANY(roles));

-- ─── 3. Revoke admin from a user ────────────────────────────
-- UPDATE public.profiles
-- SET roles = array_remove(roles, 'admin')
-- WHERE email = 'someone@example.com';

-- ─── 4. View all admins ─────────────────────────────────────
-- SELECT id, email, display_name, roles
-- FROM public.profiles
-- WHERE 'admin' = ANY(roles);
