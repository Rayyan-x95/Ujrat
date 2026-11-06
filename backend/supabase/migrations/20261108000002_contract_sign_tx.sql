-- Migration: atomic contract signing for the freelancer lane.
--
-- Replaces the JS multi-step signContract (addSignature -> update contract ->
-- update project + compensating rollback deletes) with a single transactional
-- RPC so a failure cannot leave a signature row without signed statuses
-- (or vice versa). Mirrors submit_portal_signature's write set:
--   contract_signatures insert + contracts=signed + projects=contract_signed
--   (only from 'approved') + activity_logs.
-- Idempotent: a contract already signed returns its existing signature row.

CREATE OR REPLACE FUNCTION public.sign_contract_transactional(
  p_workspace_id uuid,
  p_project_id uuid,
  p_signature_name text,
  p_signature_image text DEFAULT NULL,
  p_signature_type text DEFAULT 'typed',
  p_ip text DEFAULT NULL
)
RETURNS SETOF public.contract_signatures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID;
  v_contract_status TEXT;
  v_profile_id UUID;
  v_sig public.contract_signatures%ROWTYPE;
BEGIN
  IF p_signature_name IS NULL OR char_length(btrim(p_signature_name)) < 2 THEN
    RAISE EXCEPTION 'Signature name is required';
  END IF;

  -- Authenticated lane: caller must own the workspace. Service-role lane
  -- (auth.uid() IS NULL) only needs the workspace to exist.
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = p_workspace_id AND profile_id = auth.uid() AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Access denied to workspace %', p_workspace_id;
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.workspaces WHERE id = p_workspace_id
    ) THEN
      RAISE EXCEPTION 'Unknown workspace';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND workspace_id = p_workspace_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Unauthorized project workspace access';
  END IF;

  SELECT c.id, c.status INTO v_contract_id, v_contract_status
  FROM public.contracts c
  WHERE c.project_id = p_project_id
    AND c.workspace_id = p_workspace_id
    AND c.deleted_at IS NULL;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contract not found for specified project';
  END IF;

  -- Idempotent fast-path: return the persisted signature if already signed.
  RETURN QUERY
    SELECT cs.* FROM public.contract_signatures cs WHERE cs.contract_id = v_contract_id;
  IF FOUND THEN
    RETURN;
  END IF;

  IF v_contract_status = 'signed' THEN
    RAISE EXCEPTION 'Contract is marked signed but no persisted signature record was found';
  END IF;

  IF v_contract_status <> 'sent' THEN
    RAISE EXCEPTION 'Contract is not available for signing';
  END IF;

  SELECT w.profile_id INTO v_profile_id
  FROM public.workspaces w
  WHERE w.id = p_workspace_id;

  INSERT INTO public.contract_signatures (
    id, workspace_id, contract_id, signature_name, signature_image,
    signature_type, ip_address, signature_date
  ) VALUES (
    gen_random_uuid(), p_workspace_id, v_contract_id, p_signature_name, p_signature_image,
    COALESCE(NULLIF(btrim(p_signature_type), ''), 'typed'), COALESCE(p_ip, '0.0.0.0'), now()
  )
  ON CONFLICT (contract_id) DO NOTHING
  RETURNING * INTO v_sig;

  -- Lost a concurrent-insert race: return the winner's row without duplicating writes.
  IF v_sig.id IS NULL THEN
    RETURN QUERY
      SELECT cs.* FROM public.contract_signatures cs WHERE cs.contract_id = v_contract_id;
    RETURN;
  END IF;

  UPDATE public.contracts
  SET status = 'signed', updated_at = now()
  WHERE id = v_contract_id;

  -- Only advance from the valid predecessor; a project already further along
  -- keeps its status instead of rolling the signature insert away.
  UPDATE public.projects
  SET status = 'contract_signed', updated_at = now()
  WHERE id = p_project_id AND status = 'approved';

  INSERT INTO public.activity_logs (workspace_id, profile_id, project_id, action, details)
  VALUES (
    p_workspace_id, v_profile_id, p_project_id,
    'Contract Signed',
    jsonb_build_object(
      'contractId', v_contract_id,
      'signatureName', p_signature_name,
      'signature_type', COALESCE(NULLIF(btrim(p_signature_type), ''), 'typed')
    )
  );

  RETURN NEXT v_sig;
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sign_contract_transactional(uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sign_contract_transactional(uuid, uuid, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.sign_contract_transactional(uuid, uuid, text, text, text, text) TO authenticated, service_role;
