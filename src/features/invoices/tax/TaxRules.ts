/**
 * Ujrat Tax Engine 2.0 - Tax Rules & Place of Supply Evaluator
 * Indian GST Act Rules • LUT Export Rules • SEZ • RCM • Composition Rules
 */

import type {
  FreelancerTaxProfile,
  ClientTaxProfile,
  PlaceOfSupplyType,
  SupplyType,
  TaxScheme,
} from './TaxTypes';
import { extractStateCode } from './TaxUtilities';

export interface EvaluatedTaxRules {
  placeOfSupply: PlaceOfSupplyType;
  isInterstate: boolean;
  isZeroRated: boolean;
  suppressesGst: boolean;
  isReverseCharge: boolean;
  supplyType: SupplyType;
  taxScheme: TaxScheme;
  freelancerStateCode: string | null;
  clientStateCode: string | null;
  declarations: string[];
  warnings: string[];
}

export function evaluateTaxRules(
  freelancer: FreelancerTaxProfile,
  client: ClientTaxProfile,
  customSupplyType?: SupplyType,
  isCustomRcm?: boolean,
  customLutNumber?: string | null,
  customLutExpiryDate?: string | null
): EvaluatedTaxRules {
  const declarations: string[] = [];
  const warnings: string[] = [];

  const taxScheme: TaxScheme = freelancer.tax_scheme || (freelancer.is_gst_registered ? 'regular' : 'non_gst');
  const freeStateCode = extractStateCode(freelancer.gstin, freelancer.state);
  const clientStateCode = extractStateCode(client.gstin, client.state);

  const clientCountry = (client.country || '').trim().toLowerCase();
  const clientStateStr = (client.state || '').trim().toLowerCase();

  // Check if International Client or Foreign Export
  const isForeignClient =
    clientCountry !== '' && clientCountry !== 'india' && clientCountry !== 'in';
  
  const isExportKeyword =
    clientStateStr === 'export' ||
    clientStateStr === 'outside india' ||
    clientStateStr === 'international' ||
    clientStateStr === 'foreign' ||
    clientStateStr === 'row';

  const isExport = isForeignClient || isExportKeyword;

  // Evaluate Place of Supply
  let placeOfSupply: PlaceOfSupplyType = 'intra_state';
  let isInterstate = false;
  let isZeroRated = false;
  let suppressesGst = false;
  let supplyType: SupplyType = customSupplyType || 'taxable';

  const lutNo = customLutNumber || freelancer.lut_number;
  const lutExp = customLutExpiryDate || freelancer.lut_expiry_date;
  const isLutExpired = Boolean(
    lutExp && String(lutExp).substring(0, 10) < new Date().toISOString().substring(0, 10)
  );
  const isLutValid = Boolean(lutNo && !isLutExpired);

  suppressesGst = taxScheme === 'non_gst' || taxScheme === 'composition';

  if (isExport) {
    placeOfSupply = 'export';
    isInterstate = true;
    isZeroRated = true; // Exports are legally Zero-Rated under IGST Section 16 regardless of LUT

    if (!suppressesGst) {
      if (isLutValid) {
        supplyType = 'zero_rated_lut';
        declarations.push(`SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF UNDERTAKING (LUT NO: ${lutNo}) WITHOUT PAYMENT OF INTEGRATED TAX.`);
      } else {
        supplyType = 'zero_rated_non_lut';
        declarations.push('SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX.');
        if (!lutNo) {
          warnings.push('No active LUT Number specified for foreign client. IGST will be applied per GST export rules.');
        } else if (isLutExpired) {
          warnings.push(`LUT Number ${lutNo} expired on ${lutExp}. IGST will be applied per GST export rules.`);
        }
      }
    }
  } else if (client.is_sez) {
    placeOfSupply = 'sez';
    isInterstate = true;
    isZeroRated = true;

    if (!suppressesGst) {
      if (customSupplyType === 'sez_with_tax') {
        supplyType = 'sez_with_tax';
        declarations.push('SUPPLY TO SPECIAL ECONOMIC ZONE (SEZ) UNIT/DEVELOPER ON PAYMENT OF INTEGRATED TAX.');
      } else if (customSupplyType === 'sez_without_tax' || isLutValid) {
        supplyType = 'sez_without_tax';
        declarations.push('SUPPLY TO SPECIAL ECONOMIC ZONE (SEZ) UNIT/DEVELOPER WITHOUT PAYMENT OF INTEGRATED TAX UNDER LUT.');
      } else {
        supplyType = 'sez_with_tax';
        declarations.push('SUPPLY TO SPECIAL ECONOMIC ZONE (SEZ) UNIT/DEVELOPER ON PAYMENT OF INTEGRATED TAX.');
        if (!lutNo) {
          warnings.push('No active LUT Number specified for SEZ supply. Defaulting to SEZ supply with payment of tax.');
        } else if (isLutExpired) {
          warnings.push(`LUT Number ${lutNo} expired on ${lutExp}. Defaulting to SEZ supply with payment of tax.`);
        }
      }
    }
  } else {
    // Domestic Supply
    if (freeStateCode && clientStateCode) {
      isInterstate = freeStateCode !== clientStateCode;
    } else if (freelancer.state && client.state) {
      isInterstate = freelancer.state.trim().toLowerCase() !== client.state.trim().toLowerCase();
    }
    placeOfSupply = isInterstate ? 'inter_state' : 'intra_state';
  }

  // Handle Tax Schemes (suppresses GST collection on invoice without misclassifying domestic supplies as zero-rated)
  if (taxScheme === 'non_gst') {
    suppressesGst = true;
    declarations.push('SUPPLIER IS NOT REGISTERED UNDER GST. NO TAX CHARGED.');
  } else if (taxScheme === 'composition') {
    suppressesGst = true;
    declarations.push('COMPOSITION TAXABLE PERSON, NOT ELIGIBLE TO COLLECT TAX ON SUPPLIES.');
    if (isInterstate || isExport) {
      warnings.push('Composition scheme taxpayers are legally restricted from making inter-state or export supplies under GST Section 10.');
    }
  }

  // Handle Reverse Charge Mechanism (RCM)
  const isReverseCharge = Boolean(isCustomRcm);
  if (isReverseCharge) {
    declarations.push('TAX ON THIS INVOICE IS PAYABLE ON REVERSE CHARGE BASIS BY THE RECIPIENT OF SUPPLY.');
  }

  return {
    placeOfSupply,
    isInterstate,
    isZeroRated,
    suppressesGst,
    isReverseCharge,
    supplyType,
    taxScheme,
    freelancerStateCode: freeStateCode,
    clientStateCode: clientStateCode,
    declarations,
    warnings,
  };
}
