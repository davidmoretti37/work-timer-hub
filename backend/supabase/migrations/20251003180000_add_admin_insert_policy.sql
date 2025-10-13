-- Add INSERT policy for profiles table to allow admins to create profiles for other users
CREATE POLICY "Admins can insert profiles for any user"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Also add a policy for regular users to insert their own profiles (if needed)
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
