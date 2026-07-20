export interface TaxResult {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  isInterstate: boolean;
  isZeroRated: boolean;
  isReverseCharge: boolean;
  freelancerState: string;
  clientState: string;
  freelancerGstin: string;
  clientGstin: string;
}

export function determineGSTType(
  freelancer: { is_gst_registered: boolean; state?: string | null; gstin?: string | null },
  client: { state?: string | null; gstin?: string | null }
): { isInterstate: boolean; isZeroRated: boolean; isReverseCharge: boolean } {
  if (!freelancer.is_gst_registered || !freelancer.gstin) {
    return { isInterstate: false, isZeroRated: true, isReverseCharge: false };
  }

  const freeState = (freelancer.state || '').trim().toLowerCase();
  const clientState = (client.state || '').trim().toLowerCase();

  const freeGstin = (freelancer.gstin || '').trim();
  const clientGstin = (client.gstin || '').trim();

  // Export / International Client
  if (!clientGstin && (
    clientState === 'export' || 
    clientState === 'outside india' || 
    clientState === 'international' || 
    clientState === 'foreign' ||
    clientState === 'row'
  )) {
    return { isInterstate: true, isZeroRated: true, isReverseCharge: false };
  }

  // Check via GSTIN prefix if both exist and are valid (starts with 2 digits)
  if (/^\d{2}/.test(freeGstin) && /^\d{2}/.test(clientGstin)) {
    const freePrefix = freeGstin.substring(0, 2);
    const clientPrefix = clientGstin.substring(0, 2);
    const isInter = freePrefix !== clientPrefix;
    return { isInterstate: isInter, isZeroRated: false, isReverseCharge: false };
  }

  // Otherwise fallback to state name check
  if (freeState && clientState) {
    const isInter = freeState !== clientState;
    return { isInterstate: isInter, isZeroRated: false, isReverseCharge: false };
  }

  // Default to same-state Intrastate
  return { isInterstate: false, isZeroRated: false, isReverseCharge: false };
}

export function calculateGST(
  baseAmount: number,
  gstRate: number,
  isInterstate: boolean,
  isZeroRated: boolean
): { subtotal: number; cgst: number; sgst: number; igst: number; total: number } {
  const subtotal = Math.round(baseAmount * 100) / 100;
  
  if (isZeroRated || gstRate <= 0) {
    return {
      subtotal,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: subtotal,
    };
  }

  const gstAmount = Math.round((subtotal * (gstRate / 100)) * 100) / 100;

  if (isInterstate) {
    return {
      subtotal,
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      total: Math.round((subtotal + gstAmount) * 100) / 100,
    };
  } else {
    const splitGst = Math.round((gstAmount / 2) * 100) / 100;
    return {
      subtotal,
      cgst: splitGst,
      sgst: splitGst,
      igst: 0,
      total: Math.round((subtotal + (splitGst * 2)) * 100) / 100,
    };
  }
}

export function isValidGstin(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}
