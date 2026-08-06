-- Migration: Waitlist Table and Row Level Security
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    service TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique_idx ON public.waitlist (lower(trim(email)));

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public to insert waitlist entry" ON public.waitlist;
CREATE POLICY "Allow public to insert waitlist entry"
    ON public.waitlist
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        char_length(trim(name)) >= 2 AND
        email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND
        char_length(trim(service)) >= 2
    );

DROP POLICY IF EXISTS "Allow service role full access to waitlist" ON public.waitlist;
CREATE POLICY "Allow service role full access to waitlist"
    ON public.waitlist
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
