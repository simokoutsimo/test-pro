/*
  # Create athlete reports table

  1. New Tables
    - athlete_reports
      - id (uuid, primary key) - Unique report identifier
      - user_id (uuid, foreign key) - Reference to auth.users
      - athlete_name (text) - Name of the athlete
      - test_type (text) - Type of test: MART, VBT, or Jump
      - test_subtype (text, nullable) - Subtype for Jump tests: CMJ or RSI
      - test_date (timestamptz) - When the test was performed
      - test_data (jsonb) - Complete test results and metrics
      - created_at (timestamptz) - When the report was saved
      - updated_at (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on athlete_reports table
    - Add policy for authenticated users to read their own reports
    - Add policy for authenticated users to insert their own reports
    - Add policy for authenticated users to update their own reports
    - Add policy for authenticated users to delete their own reports

  3. Indexes
    - Index on user_id for fast queries
    - Index on athlete_name for athlete search
    - Index on test_date for date-based queries
    - Composite index on (user_id, athlete_name) for athlete filtering
*/

CREATE TABLE IF NOT EXISTS athlete_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  athlete_name text NOT NULL,
  test_type text NOT NULL CHECK (test_type IN ('MART', 'VBT', 'Jump')),
  test_subtype text,
  test_date timestamptz NOT NULL DEFAULT now(),
  test_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE athlete_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own athlete reports"
  ON athlete_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own athlete reports"
  ON athlete_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own athlete reports"
  ON athlete_reports
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own athlete reports"
  ON athlete_reports
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_athlete_reports_user_id ON athlete_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_athlete_reports_athlete_name ON athlete_reports(athlete_name);
CREATE INDEX IF NOT EXISTS idx_athlete_reports_test_date ON athlete_reports(test_date DESC);
CREATE INDEX IF NOT EXISTS idx_athlete_reports_user_athlete ON athlete_reports(user_id, athlete_name);
