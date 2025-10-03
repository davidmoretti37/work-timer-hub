-- Add DELETE and UPDATE policies for admins on time_sessions table
CREATE POLICY "Admins can delete any session"
  ON public.time_sessions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any session"
  ON public.time_sessions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
