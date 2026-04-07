-- Create flashcards table for storing AI-generated flashcards
-- Run this in your Supabase SQL editor

-- Drop existing table and recreate with correct columns
DROP TABLE IF EXISTS public.flashcards;

-- Create the flashcards table (using camelCase to match code)
CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_flashcards_userId ON public.flashcards("userId");
CREATE INDEX IF NOT EXISTS idx_flashcards_documentId ON public.flashcards("documentId");

-- Enable Row Level Security
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Allow all access for service role (used by backend)
DROP POLICY IF EXISTS "Service role full access" ON public.flashcards;
DROP POLICY IF EXISTS "Allow all authenticated" ON public.flashcards;

CREATE POLICY "Service role full access"
    ON public.flashcards
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (true);
