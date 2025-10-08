-- Allow admins to delete PTO requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pto_requests'
      AND policyname = 'Admins can delete pto requests'
  ) THEN
    CREATE POLICY "Admins can delete pto requests"
      ON public.pto_requests FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- (Optional) Allow users to delete their own pending requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pto_requests'
      AND policyname = 'Users can delete own pending pto requests'
  ) THEN
    CREATE POLICY "Users can delete own pending pto requests"
      ON public.pto_requests FOR DELETE
      USING (auth.uid() = user_id AND status = 'pending');
  END IF;
END $$;


