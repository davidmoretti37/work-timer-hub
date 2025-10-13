-- Create PTO requests table
CREATE TABLE IF NOT EXISTS public.pto_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    employee_name text NOT NULL,
    request_type text CHECK (request_type IN ('days', 'hours')) NOT NULL DEFAULT 'days',
    start_date timestamptz NOT NULL,
    end_date timestamptz NOT NULL,
    reason_type text CHECK (reason_type IN ('vacation', 'pto', 'sick', 'jury')) NOT NULL,
    custom_reason text,
    employee_signature text NOT NULL,
    status text CHECK (status IN ('pending', 'approved', 'rejected')) NOT NULL DEFAULT 'pending',
    submission_date timestamptz NOT NULL DEFAULT now(),
    employer_decision_date timestamptz,
    employer_signature text,
    employer_name text,
    admin_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pto_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for PTO requests

-- Users can view their own PTO requests
CREATE POLICY "Users can view own pto requests"
    ON public.pto_requests FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own PTO requests
CREATE POLICY "Users can insert own pto requests"
    ON public.pto_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending PTO requests
CREATE POLICY "Users can update own pending pto requests"
    ON public.pto_requests FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admins can view all PTO requests
CREATE POLICY "Admins can view all pto requests"
    ON public.pto_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can update PTO request status (approve/reject)
CREATE POLICY "Admins can update pto request status"
    ON public.pto_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pto_requests_user_id ON public.pto_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pto_requests_status ON public.pto_requests(status);
CREATE INDEX IF NOT EXISTS idx_pto_requests_start_date ON public.pto_requests(start_date);
CREATE INDEX IF NOT EXISTS idx_pto_requests_end_date ON public.pto_requests(end_date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_pto_requests_updated_at
    BEFORE UPDATE ON public.pto_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
