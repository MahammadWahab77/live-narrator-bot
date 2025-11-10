-- Add columns for detailed transcript management
ALTER TABLE onboarding_sessions
ADD COLUMN IF NOT EXISTS full_transcript JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user_id ON onboarding_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);

-- Add trigger to automatically update last_activity_at
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_onboarding_sessions_last_activity ON onboarding_sessions;

CREATE TRIGGER update_onboarding_sessions_last_activity
  BEFORE UPDATE ON onboarding_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_last_activity();