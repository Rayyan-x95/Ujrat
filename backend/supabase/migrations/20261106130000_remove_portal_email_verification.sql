-- Remove portal email/OTP verification gate from signing.
-- The portal token is already the authentication credential; the OTP step
-- is now removed from the client portal. Signing requires only a live
-- portal token and a signable contract. Existing generate/verify RPCs and
-- portal_verifications rows are left in place (dead code) so cached clients
-- and tests keep working; new clients no longer call them.

CREATE OR REPLACE FUNCTION public.submit_portal_signature(
  token_val text,
  sig_name text,
  ip_addr text DEFAULT NULL,
  sig_image text DEFAULT NULL,
  sig_type text DEFAULT 'drawn'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_workspace_id UUID;
  v_contract_id UUID;
  v_freelancer_profile_id UUID;
  v_freelancer_email TEXT;
  v_project_name TEXT;
  v_client_name TEXT;
  v_email_log_id UUID;
BEGIN
  IF sig_name IS NULL OR char_length(btrim(sig_name)) < 2 THEN
    RAISE EXCEPTION 'Signature name is required';
  END IF;

  SELECT p.id, p.workspace_id, p.name, cl.name INTO v_project_id, v_workspace_id, v_project_name, v_client_name
  FROM public.projects p
  JOIN public.clients cl ON cl.id = p.client_id
  WHERE p.portal_token = token_val
    AND p.deleted_at IS NULL
    AND public.portal_token_is_live(p.created_at, p.portal_token_expires_at);

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired portal token';
  END IF;

  -- A client can only sign a contract that was sent (or one already signed,
  -- for idempotent re-signing); draft/void contracts are not signable.
  SELECT c.id INTO v_contract_id
  FROM public.contracts c
  WHERE c.project_id = v_project_id
    AND c.deleted_at IS NULL
    AND c.status IN ('sent', 'signed');

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contract is not available for signing';
  END IF;

  SELECT w.profile_id, prof.email INTO v_freelancer_profile_id, v_freelancer_email
  FROM public.workspaces w
  JOIN public.profiles prof ON prof.id = w.profile_id
  WHERE w.id = v_workspace_id;

  INSERT INTO public.contract_signatures (
    id, workspace_id, contract_id, signature_name, signature_image,
    signature_type, ip_address, signature_date
  ) VALUES (
    gen_random_uuid(), v_workspace_id, v_contract_id, sig_name, sig_image,
    COALESCE(sig_type, 'drawn'), COALESCE(ip_addr, 'unknown'), now()
  )
  ON CONFLICT (contract_id) DO NOTHING;

  UPDATE public.contracts
  SET status = 'signed', updated_at = now()
  WHERE id = v_contract_id;

  -- Only advance the project from its valid predecessor. A project that has
  -- already moved on keeps its status instead of raising and rolling the
  -- signature insert away.
  UPDATE public.projects
  SET status = 'contract_signed', updated_at = now()
  WHERE id = v_project_id AND status = 'approved';

  INSERT INTO public.activity_logs (
    workspace_id, profile_id, project_id, action, details
  ) VALUES (
    v_workspace_id, v_freelancer_profile_id, v_project_id,
    'contract_signed_by_client',
    jsonb_build_object(
      'signature_name', sig_name,
      'signature_type', COALESCE(sig_type, 'drawn'),
      'contract_id', v_contract_id,
      'project_name', v_project_name,
      'client_name', v_client_name,
      'signed_at', now(),
      'has_signature_image', (sig_image IS NOT NULL)
    )
  );

  IF v_freelancer_email IS NOT NULL THEN
    INSERT INTO public.email_logs (
      workspace_id, profile_id, project_id, recipient, subject, body,
      status, attempts, max_attempts
    ) VALUES (
      v_workspace_id, v_freelancer_profile_id, v_project_id, v_freelancer_email,
      'Agreement Signed: ' || COALESCE(v_project_name, 'Project') || ' by ' || COALESCE(v_client_name, 'Client'),
      'Hello, your client (' || public.html_escape(v_client_name) || ') has digitally signed the project agreement for "' || public.html_escape(v_project_name) || '". ' ||
      'Signature name: ' || public.html_escape(sig_name) || ' at ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS UTC') || '. ' ||
      'Your project is now in contract_signed status and ready for execution.',
      'pending', 0, 3
    )
    RETURNING id INTO v_email_log_id;
  END IF;

  RETURN v_email_log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_portal_signature(text, text, text, text, text) TO anon, authenticated, service_role;
