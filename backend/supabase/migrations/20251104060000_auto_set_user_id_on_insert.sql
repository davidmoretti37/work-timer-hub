-- Automatically set user_id from employee_id when inserting clock_in_records
-- Migration: 20251104060000_auto_set_user_id_on_insert.sql
-- This ensures new clock-in records always have user_id set

CREATE OR REPLACE FUNCTION public.auto_set_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If user_id is not set but employee_id is, look up the user_id from employees
  IF NEW.user_id IS NULL AND NEW.employee_id IS NOT NULL THEN
    SELECT au.id INTO NEW.user_id
    FROM employees e
    JOIN auth.users au ON LOWER(e.email) = LOWER(au.email)
    WHERE e.id = NEW.employee_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on clock_in_records
DROP TRIGGER IF EXISTS auto_set_user_id_on_insert ON public.clock_in_records;
CREATE TRIGGER auto_set_user_id_on_insert
  BEFORE INSERT ON public.clock_in_records
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_user_id();

COMMENT ON FUNCTION public.auto_set_user_id() IS
  'Automatically sets user_id from employee_id when inserting clock_in_records';
