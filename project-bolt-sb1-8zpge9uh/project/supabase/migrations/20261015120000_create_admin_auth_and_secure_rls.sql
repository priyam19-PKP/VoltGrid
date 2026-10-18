/*
  # Forward Migration: Admin Users Role & Strict Row Level Security (RLS)

  1. New Table:
    - `public.admin_users`:
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users(id) with ON DELETE CASCADE)
      - `email` (text, optional for identification)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())

  2. Security Function:
    - `public.is_admin()`:
      - Checks if the requesting `auth.uid()` corresponds to an active record in `public.admin_users`.
      - Defined with `SECURITY DEFINER` and `SET search_path = public` to prevent RLS recursion and path spoofing.
      - Marked `STABLE` for PostgreSQL query plan optimization.

  3. RLS Lockdown:
    - Drops all legacy permissive `shared_*` policies on all business tables.
    - Applies strict policies restricting all CRUD operations (SELECT, INSERT, UPDATE, DELETE) exclusively to authenticated users where `public.is_admin() = true`.
    - Anonymous (`anon`) role is completely blocked from accessing or modifying business records.
    - Non-admin authenticated accounts cannot view or modify business data.
    - `admin_users` table is read-only from the client (only viewable by the user themselves or fellow active admins). Client-side inserts/updates on `admin_users` are forbidden; only server-side / dashboard SQL can provision administrators.
*/

-- 1. Create admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for high-speed admin lookup during RLS policy checks
CREATE INDEX IF NOT EXISTS idx_admin_users_lookup ON public.admin_users (user_id, is_active);

-- Enable RLS on admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 2. Create the SECURITY DEFINER authorization function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = true
  );
$$;

-- Secure execution permissions
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3. RLS Policies for admin_users table
-- Users can view their own admin record, or active admins can view all admin records
DROP POLICY IF EXISTS "admin_users_select" ON public.admin_users;
CREATE POLICY "admin_users_select" ON public.admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- No INSERT, UPDATE, DELETE policies for client roles.
-- Administrators can only be added or modified via Supabase Dashboard SQL Editor or service role.

-- 4. Revoke legacy permissive policies and enforce strict Admin RLS on all business tables
DO $$
DECLARE
  t text;
  legacy_policy text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers',
    'vehicles',
    'charging_stations',
    'charging_slots',
    'bookings',
    'charging_sessions',
    'payments',
    'maintenance',
    'reviews'
  ] LOOP
    -- Check if table exists before altering
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      -- Drop legacy permissive policies
      FOREACH legacy_policy IN ARRAY ARRAY['shared_select_', 'shared_insert_', 'shared_update_', 'shared_delete_'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', legacy_policy || t, t);
      END LOOP;

      -- Drop any previous admin policies if re-running
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admin_manage_' || t, t);

      -- Ensure RLS is active
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      -- Create comprehensive admin policy for active administrators only
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
        'admin_manage_' || t,
        t
      );
    END IF;
  END LOOP;
END $$;
