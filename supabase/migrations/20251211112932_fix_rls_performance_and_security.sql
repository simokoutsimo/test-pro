/*
  # Fix RLS Performance and Security Issues

  This migration addresses several security and performance issues identified in the database:

  ## Changes Made

  1. **RLS Policy Optimization**
     - Replaces `auth.uid()` with `(select auth.uid())` in all policies
     - This prevents re-evaluation of the function for each row, significantly improving query performance at scale
     - Affects policies: "Users can view own profile", "Users can update own profile", "Users can insert own profile"

  2. **Remove Unused Index**
     - Drops `user_profiles_email_idx` index as it's not being utilized
     - The email column is not frequently used for lookups (id-based queries are primary)

  3. **Fix Function Search Path**
     - Recreates `update_updated_at_column()` function with secure search_path
     - Sets search_path to 'pg_catalog' to prevent search path manipulation attacks

  ## Security Notes

  - All RLS policies remain functionally identical but with better performance
  - Function security is hardened against search path manipulation
  - No data is modified or lost during this migration
*/

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Recreate RLS policies with optimized auth.uid() calls
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- Drop unused email index
DROP INDEX IF EXISTS user_profiles_email_idx;

-- Recreate function with secure search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;