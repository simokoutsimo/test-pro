/*
  # Jump and VBT Session Tables

  ## Summary
  Creates tables for storing Jump Test and VBT Analyzer session data to enable
  historical tracking, progress comparison, and athlete performance analysis.

  ## New Tables
  
  ### `jump_sessions`
  - `id` (uuid, primary key) - Unique session identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `athlete_name` (text) - Name of the athlete
  - `test_mode` (text) - Type of test: 'cmj' or 'rsi'
  - `test_date` (timestamptz) - When the test was performed
  - `created_at` (timestamptz) - Record creation timestamp

  ### `jump_data`
  - `id` (uuid, primary key) - Unique jump record identifier
  - `session_id` (uuid, foreign key) - References jump_sessions
  - `jump_number` (integer) - Sequential jump number in session
  - `height` (numeric) - Jump height in centimeters
  - `flight_time` (numeric) - Flight time in milliseconds
  - `contact_time` (numeric) - Ground contact time in milliseconds
  - `rsi` (numeric, nullable) - Reactive Strength Index
  - `timestamp` (timestamptz) - When the jump occurred

  ### `vbt_sessions`
  - `id` (uuid, primary key) - Unique session identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `athlete_name` (text) - Name of the athlete
  - `test_date` (timestamptz) - When the test was performed
  - `created_at` (timestamptz) - Record creation timestamp

  ### `vbt_reps`
  - `id` (uuid, primary key) - Unique rep record identifier
  - `session_id` (uuid, foreign key) - References vbt_sessions
  - `rep_number` (integer) - Sequential rep number in session
  - `peak_velocity` (numeric) - Peak velocity in m/s
  - `avg_velocity` (numeric) - Average velocity in m/s
  - `duration` (numeric) - Rep duration in seconds
  - `timestamp` (timestamptz) - When the rep occurred

  ## Security
  - Enable RLS on all tables
  - Users can only read/write their own session data
*/

-- Create jump_sessions table
CREATE TABLE IF NOT EXISTS jump_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_name text NOT NULL,
  test_mode text NOT NULL CHECK (test_mode IN ('cmj', 'rsi')),
  test_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create jump_data table
CREATE TABLE IF NOT EXISTS jump_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES jump_sessions(id) ON DELETE CASCADE NOT NULL,
  jump_number integer NOT NULL,
  height numeric NOT NULL,
  flight_time numeric NOT NULL,
  contact_time numeric NOT NULL DEFAULT 0,
  rsi numeric,
  timestamp timestamptz DEFAULT now()
);

-- Create vbt_sessions table
CREATE TABLE IF NOT EXISTS vbt_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_name text NOT NULL,
  test_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create vbt_reps table
CREATE TABLE IF NOT EXISTS vbt_reps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES vbt_sessions(id) ON DELETE CASCADE NOT NULL,
  rep_number integer NOT NULL,
  peak_velocity numeric NOT NULL,
  avg_velocity numeric NOT NULL,
  duration numeric NOT NULL,
  timestamp timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE jump_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jump_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE vbt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vbt_reps ENABLE ROW LEVEL SECURITY;

-- Jump Sessions Policies
CREATE POLICY "Users can view own jump sessions"
  ON jump_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jump sessions"
  ON jump_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jump sessions"
  ON jump_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own jump sessions"
  ON jump_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Jump Data Policies
CREATE POLICY "Users can view own jump data"
  ON jump_data FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jump_sessions
      WHERE jump_sessions.id = jump_data.session_id
      AND jump_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own jump data"
  ON jump_data FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jump_sessions
      WHERE jump_sessions.id = jump_data.session_id
      AND jump_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own jump data"
  ON jump_data FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jump_sessions
      WHERE jump_sessions.id = jump_data.session_id
      AND jump_sessions.user_id = auth.uid()
    )
  );

-- VBT Sessions Policies
CREATE POLICY "Users can view own vbt sessions"
  ON vbt_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vbt sessions"
  ON vbt_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vbt sessions"
  ON vbt_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vbt sessions"
  ON vbt_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- VBT Reps Policies
CREATE POLICY "Users can view own vbt reps"
  ON vbt_reps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vbt_sessions
      WHERE vbt_sessions.id = vbt_reps.session_id
      AND vbt_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own vbt reps"
  ON vbt_reps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vbt_sessions
      WHERE vbt_sessions.id = vbt_reps.session_id
      AND vbt_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own vbt reps"
  ON vbt_reps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vbt_sessions
      WHERE vbt_sessions.id = vbt_reps.session_id
      AND vbt_sessions.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jump_sessions_user_id ON jump_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_jump_sessions_test_date ON jump_sessions(test_date DESC);
CREATE INDEX IF NOT EXISTS idx_jump_data_session_id ON jump_data(session_id);
CREATE INDEX IF NOT EXISTS idx_vbt_sessions_user_id ON vbt_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_vbt_sessions_test_date ON vbt_sessions(test_date DESC);
CREATE INDEX IF NOT EXISTS idx_vbt_reps_session_id ON vbt_reps(session_id);
