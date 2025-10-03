-- Add admin_display_name field to profiles table for admin-only custom names
ALTER TABLE public.profiles 
ADD COLUMN admin_display_name TEXT;

-- Update policy to allow admins to update this field
CREATE POLICY "Admins can update admin display names"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
