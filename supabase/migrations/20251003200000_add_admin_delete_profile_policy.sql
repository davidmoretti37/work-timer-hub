-- Add DELETE policy for admins on profiles table (this will cascade to delete related data)
CREATE POLICY "Admins can delete any profile"
  ON public.profiles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
