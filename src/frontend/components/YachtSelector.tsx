import { formatEuro } from '../../shared/pricing';
import type { Yacht } from '../../shared/types';

interface YachtSelectorProps {
  yachts: Yacht[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedYachtId?: string;
  onSelect: (yachtId: string) => void;
}

export default function YachtSelector({ yachts, loading, error, onRetry, selectedYachtId, onSelect }: YachtSelectorProps) {
  return (
    <section className="yacht-selector" aria-labelledby="yacht-heading">
      <h2 id="yacht-heading">Select your yacht</h2>
      {loading && (
        <div className="loading" role="status">
          <span className="spinner" aria-hidden="true" /> Loading yachts…
        </div>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}{' '}
          <button type="button" className="link-button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      <div className="yacht-grid" role="group" aria-labelledby="yacht-heading">
        {yachts.map(yacht => {
          const selected = selectedYachtId === yacht.id;
          return (
            <button
              type="button"
              key={yacht.id}
              className={`yacht-card ${selected ? 'selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect(yacht.id)}
            >
              {yacht.photoUrl && <img src={yacht.photoUrl} alt={`${yacht.name} yacht`} className="yacht-photo" />}
              <span className="yacht-info">
                <span className="yacht-name">{yacht.name}</span>
                <span className="yacht-specs">
                  {yacht.lengthMeters} m · {yacht.cabins} cabins · up to {yacht.maxGuests} guests
                </span>
                <span className="yacht-price">from {formatEuro(yacht.weeklyRateEuro)} / week</span>
              </span>
              {selected && <span className="selected-tag">Selected</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
