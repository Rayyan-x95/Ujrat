import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentRepository } from '@/features/payments/repositories/PaymentRepository';

// Optimistic-concurrency stub: records every chained .eq so the test can
// assert the verify path really scoped its update to the expected status.
const stub = vi.hoisted(() => {
  const state: { final: { data: unknown; error: unknown }; eqCalls: Array<[string, unknown]>; updatePayload: unknown } = {
    final: { data: null, error: null },
    eqCalls: [],
    updatePayload: null,
  };
  const chain: any = {
    update: (payload: unknown) => {
      state.updatePayload = payload;
      return chain;
    },
    eq: (col: string, val: unknown) => {
      state.eqCalls.push([col, val]);
      return chain;
    },
    select: () => chain,
    single: () => Promise.resolve(state.final),
  };
  return { state, supabase: { from: () => chain } };
});

vi.mock('@/shared/lib/supabaseClient', () => ({ supabase: stub.supabase }));

describe('PaymentRepository.verifyPayment optimistic race guard', () => {
  beforeEach(() => {
    stub.state.eqCalls = [];
    stub.state.updatePayload = null;
  });

  it('scopes the update to the status it expects to verify from', async () => {
    stub.state.final = { data: { id: 'p1', status: 'completed' }, error: null };
    const payment = await PaymentRepository.verifyPayment('ws-1', 'p1', 'pf-1', 'completed', undefined, 'pending');
    expect(payment.id).toBe('p1');
    expect(stub.state.updatePayload).toMatchObject({ status: 'completed' });
    expect(new Map(stub.state.eqCalls).get('status')).toBe('pending');
  });

  it('writes without a status guard when none is supplied (legacy callers)', async () => {
    stub.state.final = { data: { id: 'p1', status: 'completed' }, error: null };
    await PaymentRepository.verifyPayment('ws-1', 'p1', 'pf-1', 'completed');
    expect(new Map(stub.state.eqCalls).has('status')).toBe(false);
  });

  it('rejects a second verifier racing a settled payment (zero matching rows)', async () => {
    // The first verifier flips status pending -> completed; this update is
    // scoped to `pending`, so the database matches no row and the write fails
    // instead of overwriting the first decision.
    stub.state.final = { data: null, error: { message: 'Queried one row but got 0 results' } };
    await expect(
      PaymentRepository.verifyPayment('ws-1', 'p1', 'pf-2', 'completed', undefined, 'pending')
    ).rejects.toThrow();
    expect(new Map(stub.state.eqCalls).get('status')).toBe('pending');
    expect(stub.state.updatePayload).toMatchObject({ status: 'completed' });
  });
});
