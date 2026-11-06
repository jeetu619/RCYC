import React, { useState, useEffect } from 'react';
import { getYachts } from '../api/client';
import type { IndicativePricing } from '../../shared/types';

interface PricingSummaryProps {
  yachtId?: string;
}

export default function PricingSummary({ yachtId }: PricingSummaryProps) {
  const [pricing, setPricing] = useState<IndicativePricing | null>(null);

  useEffect(() => {
    const calculatePricing = async () => {
      if (!yachtId) {
        setPricing(null);
        return;
      }

      try {
        const yachts = await getYachts();
        const yacht = yachts.find(y => y.id === yachtId);
        if (!yacht) return;

        const charterFee = yacht.weeklyRateEuro;
        const vat = charterFee * 0.12;
        const apa = charterFee * 0.3;
        const total = charterFee + vat + apa;
        const deposit = total * 0.5;

        setPricing({
          charterFee,
          vat,
          apa,
          total,
          deposit
        });
      } catch (error) {
        console.error('Failed to calculate pricing', error);
      }
    };

    calculatePricing();
  }, [yachtId]);

  if (!pricing) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <div className="pricing-summary">
      <h3>Indicative Estimate</h3>
      <div className="pricing-row">
        <span>Charter Fee</span>
        <span>{formatPrice(pricing.charterFee)}</span>
      </div>
      <div className="pricing-row">
        <span>VAT 12%</span>
        <span>{formatPrice(pricing.vat)}</span>
      </div>
      <div className="pricing-row">
        <span>APA 30%</span>
        <span>{formatPrice(pricing.apa)}</span>
      </div>
      <div className="pricing-row total">
        <span>Total</span>
        <span>{formatPrice(pricing.total)}</span>
      </div>
      <div className="pricing-row deposit">
        <span>50% Deposit</span>
        <span>{formatPrice(pricing.deposit)}</span>
      </div>
    </div>
  );
}
