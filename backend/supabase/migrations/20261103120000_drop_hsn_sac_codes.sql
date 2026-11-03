-- Migration: Drop public.hsn_sac_codes
-- The HSN/SAC reference table was never referenced by any code (frontend,
-- backend, or edge functions); the tax engine and repositories take HSN/SAC
-- codes as free-text line-item fields. Removing the readerless table and its
-- 7 seed rows. Seoul (rollback archive) keeps its copy untouched.

DROP TABLE IF EXISTS public.hsn_sac_codes;
