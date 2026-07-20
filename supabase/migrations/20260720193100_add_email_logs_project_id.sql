-- Add project_id column to email_logs table to link sent notifications with their projects
ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
