import { calculatePricing, formatEuro } from '../../shared/pricing';
import { APA_RATE, DEPOSIT_RATE, VAT_RATE } from '../../shared/constants';
import type { Yacht } from '../../shared/types';

interface PricingSummaryProps {
  yacht?: Yacht;
  /** The panel shows once a yacht and a start date are chosen (US-07). */
  hasDate: boolean;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function PricingSummary({ yacht, hasDate }: PricingSummaryProps) {
  if (!yacht || !hasDate) {
    return (
      <aside className="pricing-summary placeholder" aria-label="Indicative estimate">
        <h3>Indicative estimate</h3>
        <p className="hint">Select a yacht and start date to see an estimate.</p>
      </aside>
    );
  }

  const pricing = calculatePricing(yacht.weeklyRateEuro);
  return (
    <>
      <aside className="pricing-summary" aria-label="Indicative estimate">
        <h3>Indicative estimate</h3>
        <dl>
          <div className="pricing-row">
            <dt>Charter Fee</dt>
            <dd>{formatEuro(pricing.charterFee)}</dd>
          </div>
          <div className="pricing-row">
            <dt>VAT {pct(VAT_RATE)}</dt>
            <dd>{formatEuro(pricing.vat)}</dd>
          </div>
          <div className="pricing-row">
            <dt>APA {pct(APA_RATE)}</dt>
            <dd>{formatEuro(pricing.apa)}</dd>
          </div>
          <div className="pricing-row total">
            <dt>Total</dt>
            <dd>{formatEuro(pricing.total)}</dd>
          </div>
          <div className="pricing-row deposit">
            <dt>{pct(DEPOSIT_RATE)} Deposit</dt>
            <dd>{formatEuro(pricing.deposit)}</dd>
          </div>
        </dl>
        <p className="hint">Indicative only. A formal quote follows by email.</p>
      </aside>
      <div className="price-bar" aria-label="Indicative total">
        <span>
          Total <strong>{formatEuro(pricing.total)}</strong>
        </span>
        <span>
          Deposit <strong>{formatEuro(pricing.deposit)}</strong>
        </span>
      </div>
    </>
  );
}
