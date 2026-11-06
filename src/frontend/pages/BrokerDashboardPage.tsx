import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  brokerLogin,
  brokerLogout,
  getBrokerEnquiries,
  getBrokerSession,
  getYachts,
  BrokerFilters
} from '../api/client';
import { formatShortDate } from '../../shared/dates';
import type { BrokerEnquiryListResponse, Yacht } from '../../shared/types';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  ['Submitted', 'Submitted'],
  ['Available', 'Available'],
  ['OnHold', 'On Hold'],
  ['Booked', 'Booked'],
  ['CapacityExceeded', 'Capacity Exceeded'],
  ['IntegrationError', 'Integration Error']
];
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS);

function BrokerLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await brokerLogin(code);
      onSignedIn();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'That access code was not recognised.' : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page broker-dashboard-page">
      <main id="main" className="login-card">
        <h1>Charter Broker sign-in</h1>
        <p className="hint">This area is restricted to Charter Brokers.</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="accessCode">Broker access code</label>
            <input id="accessCode" type="password" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} aria-invalid={!!error} />
          </div>
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy || !code}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  );
}

function Dashboard({ onSignedOut }: { onSignedOut: () => void }) {
  const [data, setData] = useState<BrokerEnquiryListResponse | null>(null);
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: '', yachtId: '', dateFrom: '', dateTo: '' });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    getYachts().then(setYachts).catch(() => undefined);
  }, []);

  // Debounce free-text search so the table isn't re-queried on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query: BrokerFilters = { ...filters, search, page, pageSize: PAGE_SIZE };
    try {
      setData(await getBrokerEnquiries(query));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await brokerLogout();
        onSignedOut();
        return;
      }
      setError('We could not load the enquiries. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, search, page, onSignedOut]);

  useEffect(() => {
    load();
  }, [load, attempt]);

  const setFilter = (field: keyof typeof filters, value: string) => {
    setFilters(f => ({ ...f, [field]: value }));
    setPage(1);
  };
  const dateRangeInvalid = !!filters.dateFrom && !!filters.dateTo && filters.dateFrom > filters.dateTo;
  const filtersActive = !!(filters.status || filters.yachtId || filters.dateFrom || filters.dateTo || search);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const kpis = data?.kpis ?? { today: 0, available: 0, unavailable: 0, percentAvailable: 0 };
  const tiles = [
    ["Today's Enquiries", kpis.today],
    ['Available', kpis.available],
    ['Unavailable', kpis.unavailable],
    ['% Available', `${kpis.percentAvailable}%`]
  ] as const;

  return (
    <div className="page broker-dashboard-page">
      <header className="page-header dashboard-header">
        <div>
          <h1>Broker Enquiries</h1>
          <p>View, filter, search and monitor charter enquiries</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            await brokerLogout();
            onSignedOut();
          }}
        >
          Sign out
        </button>
      </header>

      <main id="main" className="dashboard-content">
        <section className="kpi-section" aria-label="Key figures">
          {tiles.map(([label, value]) => (
            <div className="kpi-tile" key={label}>
              <div className="kpi-value" aria-label={`${label}: ${value}`}>{value}</div>
              <div className="kpi-label">{label}</div>
            </div>
          ))}
        </section>

        <section className="filters-section" aria-label="Filters">
          <div className="form-group grow">
            <label htmlFor="search">Search</label>
            <input
              id="search"
              type="search"
              placeholder="Client name, yacht or reference"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="statusFilter">Status</label>
            <select id="statusFilter" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="yachtFilter">Yacht</label>
            <select id="yachtFilter" value={filters.yachtId} onChange={e => setFilter('yachtId', e.target.value)}>
              <option value="">All yachts</option>
              {yachts.map(y => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="dateFrom">Received from</label>
            <input id="dateFrom" type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="dateTo">Received to</label>
            <input id="dateTo" type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} />
          </div>
          {filtersActive && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setFilters({ status: '', yachtId: '', dateFrom: '', dateTo: '' });
                setSearchInput('');
                setSearch('');
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
        </section>
        {dateRangeInvalid && (
          <div className="error-message" role="alert">
            The “from” date must not be after the “to” date.
          </div>
        )}

        {error && (
          <div className="error-summary" role="alert">
            <strong>{error}</strong>{' '}
            <button type="button" className="link-button" onClick={() => setAttempt(a => a + 1)}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="loading" role="status">
            <span className="spinner" aria-hidden="true" /> Loading enquiries…
          </div>
        ) : !error && data && data.enquiries.length === 0 ? (
          <div className="empty-state">No enquiries found for the current filters{search ? ' and search' : ''}.</div>
        ) : (
          data && (
            <>
              <div className="enquiries-table">
                <table>
                  <caption className="visually-hidden">Charter enquiries</caption>
                  <thead>
                    <tr>
                      <th scope="col">Reference</th>
                      <th scope="col">Client</th>
                      <th scope="col">Yacht</th>
                      <th scope="col">Dates</th>
                      <th scope="col">Guests</th>
                      <th scope="col">Status</th>
                      <th scope="col">Received Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.enquiries.map(e => (
                      <tr key={e.reference}>
                        <td className="reference">{e.reference}</td>
                        <td>{e.clientName}</td>
                        <td>{e.yachtName}</td>
                        <td>{formatShortDate(e.startDate)} – {formatShortDate(e.endDate)}</td>
                        <td>{e.guests}</td>
                        <td>
                          <span className={`chip chip-${e.status.toLowerCase()}`}>{STATUS_LABEL[e.status] ?? e.status}</span>
                        </td>
                        <td>{formatShortDate(e.receivedDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav className="pagination" aria-label="Pagination">
                <button type="button" className="btn btn-secondary" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                  Previous
                </button>
                <span>
                  Page {page} of {pages} · {data.total} enquir{data.total === 1 ? 'y' : 'ies'}
                </span>
                <button type="button" className="btn btn-secondary" onClick={() => setPage(p => p + 1)} disabled={page >= pages}>
                  Next
                </button>
              </nav>
            </>
          )
        )}
      </main>
    </div>
  );
}

export default function BrokerDashboardPage() {
  const [signedIn, setSignedIn] = useState(!!getBrokerSession());
  const onSignedOut = useCallback(() => setSignedIn(false), []);
  return signedIn ? <Dashboard onSignedOut={onSignedOut} /> : <BrokerLogin onSignedIn={() => setSignedIn(true)} />;
}
