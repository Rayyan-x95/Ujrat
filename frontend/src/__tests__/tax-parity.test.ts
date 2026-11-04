import { describe, expect, it } from 'vitest';
import { calculateInvoiceTax } from '../features/invoices/tax/InvoiceCalculator';
import golden from './tax-parity.json';

// Shared golden fixture with backend/tests/test_parity.py - Python engine and
// TypeScript engine must reproduce the same numbers on the same statutory
// cases, or a money-vs-statutory-output drift exists somewhere in the app.
const cases = golden.cases as Array<{
  name: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
}>;

const NUMERIC_KEYS = [
  'subtotal', 'discount_amount', 'post_tax_discount', 'taxable_amount',
  'cgst', 'sgst', 'igst', 'cess', 'total_gst', 'round_off', 'grand_total',
  'tds_rate', 'tds_amount', 'net_receivable', 'inr_grand_total',
] as const;

const EXACT_KEYS = [
  'discount_type', 'discount_scope', 'is_interstate', 'is_zero_rated',
  'is_reverse_charge', 'place_of_supply', 'supply_type', 'tax_scheme', 'currency',
] as const;

describe('Tax engine parity with the backend Python engine', () => {
  it.each(cases)('$name matches the backend engine on the golden fixture', ({ name, input, expected }) => {
    const { breakdown } = calculateInvoiceTax(input as never);
    for (const key of NUMERIC_KEYS) {
      if (key in expected) expect(breakdown[key], `${name}: ${key}`).toBe(expected[key]);
    }
    for (const key of EXACT_KEYS) {
      if (key in expected) expect(breakdown[key], `${name}: ${key}`).toBe(expected[key]);
    }
  });
});
