-- Add date_of_birth column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Create index for birthday queries (optional but improves performance)
CREATE INDEX IF NOT EXISTS idx_profiles_date_of_birth ON profiles(date_of_birth);

-- Update RLS policy to allow all authenticated users to read birthdays
-- Users can already read profiles, so this just ensures the new column is accessible
