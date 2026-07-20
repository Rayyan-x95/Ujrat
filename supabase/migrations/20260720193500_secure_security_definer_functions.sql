-- Revoke public execute access from SECURITY DEFINER functions conditionally.
-- Using DO blocks ensures the migration succeeds even if some functions do not exist yet.

-- 1. get_portal_project
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_project') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_project(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_project(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 2. get_portal_client
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_client') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_client(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_client(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 3. get_portal_settings
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_settings') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_settings(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_settings(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 4. get_portal_proposal
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_proposal') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_proposal(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_proposal(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 5. get_portal_contract
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_contract') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_contract(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_contract(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 6. get_portal_invoices
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_invoices') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_invoices(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_invoices(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 7. get_portal_deliverables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_portal_deliverables') THEN
        REVOKE EXECUTE ON FUNCTION public.get_portal_deliverables(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_portal_deliverables(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 8. generate_portal_verification
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'generate_portal_verification') THEN
        REVOKE EXECUTE ON FUNCTION public.generate_portal_verification(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.generate_portal_verification(text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 9. verify_portal_code
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'verify_portal_code') THEN
        REVOKE EXECUTE ON FUNCTION public.verify_portal_code(text, text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.verify_portal_code(text, text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 10. submit_portal_signature
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'submit_portal_signature') THEN
        REVOKE EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, boolean) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, boolean) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 11. submit_portal_payment
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'submit_portal_payment') THEN
        REVOKE EXECUTE ON FUNCTION public.submit_portal_payment(text, UUID, NUMERIC, text, text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.submit_portal_payment(text, UUID, NUMERIC, text, text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 12. submit_portal_brief_feedback
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'submit_portal_brief_feedback') THEN
        REVOKE EXECUTE ON FUNCTION public.submit_portal_brief_feedback(text, text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.submit_portal_brief_feedback(text, text) TO anon, authenticated, service_role;
    END IF;
END $$;

-- 13. approve_portal_proposal
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'approve_portal_proposal') THEN
        REVOKE EXECUTE ON FUNCTION public.approve_portal_proposal(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.approve_portal_proposal(text) TO anon, authenticated, service_role;
    END IF;
END $$;


-- 14. create_invoice_transactional
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'create_invoice_transactional') THEN
        REVOKE EXECUTE ON FUNCTION public.create_invoice_transactional(uuid, jsonb, jsonb) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.create_invoice_transactional(uuid, jsonb, jsonb) TO authenticated, service_role;
    END IF;
END $$;

-- 15. mark_invoice_paid_transactional
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'mark_invoice_paid_transactional') THEN
        REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.mark_invoice_paid_transactional(uuid, uuid, uuid) TO authenticated, service_role;
    END IF;
END $$;


-- 16. get_next_invoice_serial
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_next_invoice_serial') THEN
        REVOKE EXECUTE ON FUNCTION public.get_next_invoice_serial(uuid, text, date) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_next_invoice_serial(uuid, text, date) TO authenticated, service_role;
    END IF;
END $$;


-- 17. handle_new_user
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'handle_new_user') THEN
        REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
    END IF;
END $$;

-- 18. validate_project_status_transition
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'validate_project_status_transition') THEN
        REVOKE EXECUTE ON FUNCTION public.validate_project_status_transition() FROM PUBLIC;
    END IF;
END $$;

-- 19. log_project_status_transition
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'log_project_status_transition') THEN
        REVOKE EXECUTE ON FUNCTION public.log_project_status_transition() FROM PUBLIC;
    END IF;
END $$;

-- 20. enforce_invoice_immutability
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'enforce_invoice_immutability') THEN
        REVOKE EXECUTE ON FUNCTION public.enforce_invoice_immutability() FROM PUBLIC;
    END IF;
END $$;

-- 21. enforce_invoice_items_immutability
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'enforce_invoice_items_immutability') THEN
        REVOKE EXECUTE ON FUNCTION public.enforce_invoice_items_immutability() FROM PUBLIC;
    END IF;
END $$;

-- 22. archive_invoice_revision
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'archive_invoice_revision') THEN
        REVOKE EXECUTE ON FUNCTION public.archive_invoice_revision() FROM PUBLIC;
    END IF;
END $$;

-- 23. check_project_workspace_alignment
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'check_project_workspace_alignment') THEN
        REVOKE EXECUTE ON FUNCTION public.check_project_workspace_alignment() FROM PUBLIC;
    END IF;
END $$;

-- 24. check_payment_workspace_alignment
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'check_payment_workspace_alignment') THEN
        REVOKE EXECUTE ON FUNCTION public.check_payment_workspace_alignment() FROM PUBLIC;
    END IF;
END $$;
