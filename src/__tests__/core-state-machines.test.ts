import { describe, it, expect } from 'vitest';
import { ProjectStateMachine, InvoiceStateMachine, PaymentStateMachine, ProposalStateMachine } from '@/shared/utils/StateMachine';

describe('State Machines', () => {
  describe('ProjectStateMachine', () => {
    it('lead -> proposal should be valid', () => {
      expect(ProjectStateMachine.validate('lead', 'proposal')).toBe(true);
    });

    it('contract_signed -> in_progress should be valid', () => {
      expect(ProjectStateMachine.validate('contract_signed', 'in_progress')).toBe(true);
    });

    it('invoice_sent -> delivered should be valid (reversion)', () => {
      expect(ProjectStateMachine.validate('invoice_sent', 'delivered')).toBe(true);
    });

    it('lead -> paid should be invalid', () => {
      expect(ProjectStateMachine.validate('lead', 'paid')).toBe(false);
    });

    it('same state should be valid', () => {
      expect(ProjectStateMachine.validate('lead', 'lead')).toBe(true);
    });
  });

  describe('ProposalStateMachine', () => {
    it('draft -> sent should be valid', () => {
      expect(ProposalStateMachine.validate('draft', 'sent')).toBe(true);
    });

    it('sent -> approved should be valid', () => {
      expect(ProposalStateMachine.validate('sent', 'approved')).toBe(true);
    });

    it('sent -> revision_requested should be valid', () => {
      expect(ProposalStateMachine.validate('sent', 'revision_requested')).toBe(true);
    });

    it('draft -> approved should be invalid', () => {
      expect(ProposalStateMachine.validate('draft', 'approved')).toBe(false);
    });

    it('rejected -> sent should be valid', () => {
      expect(ProposalStateMachine.validate('rejected', 'sent')).toBe(true);
    });
  });

  describe('InvoiceStateMachine', () => {
    it('draft -> sent should be valid', () => {
      expect(InvoiceStateMachine.validate('draft', 'sent')).toBe(true);
    });

    it('sent -> pending_verification should be valid', () => {
      expect(InvoiceStateMachine.validate('sent', 'pending_verification')).toBe(true);
    });

    it('draft -> paid should be invalid', () => {
      expect(InvoiceStateMachine.validate('draft', 'paid')).toBe(false);
    });
  });

  describe('PaymentStateMachine', () => {
    it('pending -> completed should be valid', () => {
      expect(PaymentStateMachine.validate('pending', 'completed')).toBe(true);
    });

    it('pending -> failed should be valid', () => {
      expect(PaymentStateMachine.validate('pending', 'failed')).toBe(true);
    });

    it('completed -> failed should be invalid', () => {
      expect(PaymentStateMachine.validate('completed', 'failed')).toBe(false);
    });
  });
});