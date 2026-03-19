-- Create resources table for document management
-- Run this in your Supabase SQL editor

-- Create the resources table
CREATE TABLE IF NOT EXISTS public.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL,
    public_url TEXT,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster user queries
CREATE INDEX IF NOT EXISTS idx_resources_user_id ON public.resources(user_id);
CREATE INDEX IF NOT EXISTS idx_resources_status ON public.resources(status);

-- Enable Row Level Security
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own resources
CREATE POLICY "Users can view their own resources"
    ON public.resources
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own resources
CREATE POLICY "Users can insert their own resources"
    ON public.resources
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own resources
CREATE POLICY "Users can update their own resources"
    ON public.resources
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own resources
CREATE POLICY "Users can delete their own resources"
    ON public.resources
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can do everything (for backend)
CREATE POLICY "Service role has full access"
    ON public.resources
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_resources_updated_at ON public.resources;
CREATE TRIGGER update_resources_updated_at
    BEFORE UPDATE ON public.resources
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;
