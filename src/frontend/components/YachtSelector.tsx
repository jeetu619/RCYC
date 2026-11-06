import React, { useState, useEffect } from 'react';
import { getYachts } from '../api/client';
import type { Yacht } from '../../shared/types';

interface YachtSelectorProps {
  selectedYachtId?: string;
  onSelect: (yachtId: string) => void;
}

export default function YachtSelector({ selectedYachtId, onSelect }: YachtSelectorProps) {
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadYachts() {
      try {
        const data = await getYachts();
        setYachts(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadYachts();
  }, []);

  if (loading) return <div className="loading">Loading yachts...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="yacht-selector">
      <h2>Select Your Yacht</h2>
      <div className="yacht-grid">
        {yachts.map(yacht => (
          <div
            key={yacht.id}
            className={`yacht-card ${selectedYachtId === yacht.id ? 'selected' : ''}`}
            onClick={() => onSelect(yacht.id)}
          >
            {yacht.photoUrl && (
              <img src={yacht.photoUrl} alt={yacht.name} className="yacht-photo" />
            )}
            <div className="yacht-info">
              <h3>{yacht.name}</h3>
              <p className="yacht-specs">
                {yacht.lengthMeters}m · {yacht.cabins} cabins · {yacht.maxGuests} guests
              </p>
              <p className="yacht-price">from €{(yacht.weeklyRateEuro / 1000).toFixed(0)}k / week</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
