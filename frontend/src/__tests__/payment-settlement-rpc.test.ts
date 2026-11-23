import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentRepository } from '@/features/payments/repositories/PaymentRepository';

// RPC stub: records the function name and params so the test can assert the
// wrapper really delegates settlement to the atomic DB function.
const stub = vi.hoisted(() => {
  const state: { result: { data: unknown; error: unknown }; calls: Array<{ fn: string; params: unknown }> } = {
    result: { data: null, error: null },
    calls: [],
  };
  return {
    state,
    supabase: {
      rpc: (fn: string, params: unknown) => {
        state.calls.push({ fn, params });
        return Promise.resolve(state.result);
      },
    },
  };
});

vi.mock('@/shared/lib/supabaseClient', () => ({ supabase: stub.supabase }));

describe('PaymentRepository.verifyPaymentTransactional (atomic settlement wrapper)', () => {
  beforeEach(() => {
    stub.state.calls = [];
    stub.state.result = { data: null, error: null };
  });

  it('delegates approve to verify_payment_transactional with the exact payment id', async () => {
    const dbPayment = { id: 'p1', status: 'completed', verifier_id: 'pf-1' };
    const dbInvoice = { id: 'inv-1', status: 'partially_paid', outstanding_balance: 600 };
    stub.state.result = { data: { success: true, payment: dbPayment, invoice: dbInvoice }, error: null };

    const res = await PaymentRepository.verifyPaymentTransactional('ws-1', 'pf-1', 'inv-1', 'p1', true, 'ok');

    expect(stub.state.calls).toHaveLength(1);
    expect(stub.state.calls[0]!.fn).toBe('verify_payment_transactional');
    expect(stub.state.calls[0]!.params).toEqual({
      p_workspace_id: 'ws-1',
      p_profile_id: 'pf-1',
      p_invoice_id: 'inv-1',
      p_payment_id: 'p1',
      p_approve: true,
      p_notes: 'ok',
    });
    // Returns the DB rows, never a client-fabricated object.
    expect(res.payment).toEqual(dbPayment);
    expect(res.invoice).toEqual(dbInvoice);
  });

  it('delegates reject with approve=false and null notes', async () => {
    stub.state.result = { data: { success: true, payment: { id: 'p1', status: 'failed' }, invoice: { id: 'inv-1', status: 'sent' } }, error: null };

    await PaymentRepository.verifyPaymentTransactional('ws-1', 'pf-1', 'inv-1', 'p1', false);

    expect(stub.state.calls[0]!.params).toMatchObject({ p_approve: false, p_notes: null });
  });

  it('propagates the RPC error (race loser / terminal payment / over-balance)', async () => {
    stub.state.result = { data: null, error: { message: 'Payment is not awaiting verification' } };

    await expect(
      PaymentRepository.verifyPaymentTransactional('ws-1', 'pf-2', 'inv-1', 'p1', true)
    ).rejects.toThrow('Payment is not awaiting verification');
  });
});
