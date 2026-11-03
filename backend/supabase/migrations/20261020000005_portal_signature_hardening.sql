-- Migration: Harden the portal signature RPC
-- Three defects in submit_portal_signature():
--
-- 1. Lost signatures. The function unconditionally set the project status to
--    'contract_signed'. validate_project_status_transition() only allows that
--    from 'approved', so a client signing from a stale page (project already
--    advanced to contract_signed, advance_paid, in_progress, ...) raised
--    "Invalid transition from contract_signed to contract_signed". The whole
--    function is one transaction, so the signature insert was rolled back with
--    it: the client was told signing failed and no signature was stored. The
--    project update is now conditional on the valid predecessor, so a late or
--    repeated signature is still recorded and never lost.
--
-- 2. Draft and void contracts were signable. The contract lookup only
--    filtered deleted_at. It now requires a contract the client can actually
--    sign: 'sent' (or an already 'signed' one, for a repeat signature).
--
-- 3. email_verified was decorative - the parameter was never read. It is now
--    enforced, so the flag means what it says.

CREATE OR REPLACE FUNCTION public.submit_portal_signature(
  token_val text,
  sig_name text,
  ip_addr text DEFAULT NULL,
  email_verified boolean DEFAULT true,
  sig_image text DEFAULT NULL,
  sig_type text DEFAULT 'drawn'
)
RETURNS void
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
BEGIN
  IF email_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'Email verification is required before signing';
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
    id,
    workspace_id,
    contract_id,
    signature_name,
    signature_image,
    signature_type,
    ip_address,
    signature_date
  ) VALUES (
    gen_random_uuid(),
    v_workspace_id,
    v_contract_id,
    sig_name,
    sig_image,
    COALESCE(sig_type, 'drawn'),
    COALESCE(ip_addr, 'unknown'),
    now()
  );

  UPDATE public.contracts
  SET status = 'signed', updated_at = now()
  WHERE id = v_contract_id;

  -- Only advance the project from its valid predecessor. A project that has
  -- already moved on (or whose status is not 'approved') keeps its status
  -- instead of raising and rolling the signature away.
  UPDATE public.projects
  SET status = 'contract_signed', updated_at = now()
  WHERE id = v_project_id AND status = 'approved';

  INSERT INTO public.activity_logs (
    workspace_id,
    profile_id,
    project_id,
    action,
    details
  ) VALUES (
    v_workspace_id,
    v_freelancer_profile_id,
    v_project_id,
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
      workspace_id,
      profile_id,
      project_id,
      recipient,
      subject,
      body,
      status,
      attempts,
      max_attempts
    ) VALUES (
      v_workspace_id,
      v_freelancer_profile_id,
      v_project_id,
      v_freelancer_email,
      'Agreement Signed: ' || v_project_name || ' by ' || COALESCE(v_client_name, 'Client'),
      'Hello, your client (' || COALESCE(v_client_name, 'Client') || ') has digitally signed the project agreement for "' || v_project_name || '". ' ||
      'Signature name: ' || sig_name || ' at ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS UTC') || '. ' ||
      'Your project is now in contract_signed status and ready for execution.',
      'pending',
      0,
      3
    );
  END IF;
END;
$$;
