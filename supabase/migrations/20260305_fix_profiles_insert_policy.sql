-- Run this in the Supabase SQL Editor to add the missing INSERT policy
-- This allows the client-side fallback to create profiles when the DB trigger is slow

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
