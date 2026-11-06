import { APA_RATE, DEPOSIT_RATE, VAT_RATE } from './constants';
import type { IndicativePricing } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** R-07 .. R-09: VAT 12% and APA 30% of the weekly rate; deposit is 50% of the total. */
export function calculatePricing(weeklyRateEuro: number): IndicativePricing {
  const charterFee = weeklyRateEuro;
  const vat = round2(charterFee * VAT_RATE);
  const apa = round2(charterFee * APA_RATE);
  const total = round2(charterFee + vat + apa);
  const deposit = round2(total * DEPOSIT_RATE);
  return { charterFee, vat, apa, total, deposit };
}

export function formatEuro(amount: number): string {
  return `€${Math.round(amount).toLocaleString('en-US')}`;
}
