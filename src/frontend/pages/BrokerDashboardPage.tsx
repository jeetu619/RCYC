import React, { useState, useEffect } from 'react';
import { getBrokerEnquiries } from '../api/client';

const BROKER_TOKEN = 'broker-token-123';

export default function BrokerDashboardPage() {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ today: 0, available: 0, unavailable: 0, percentAvailable: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: '', yachtId: '', search: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadEnquiries = async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBrokerEnquiries(
        {
          status: filters.status || undefined,
          yachtId: filters.yachtId || undefined,
          search: filters.search || undefined,
          page: pageNum,
          pageSize: 10
        },
        BROKER_TOKEN
      );
      setEnquiries(data.enquiries);
      setKpis(data.kpis);
      setTotal(data.total);
      setPage(pageNum);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnquiries(1);
  }, [filters]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const getStatusBadgeClass = (status: string) => {
    return `status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="page broker-dashboard-page">
      <header className="page-header">
        <h1>Broker Dashboard</h1>
        <p>Manage and monitor charter enquiries</p>
      </header>

      <main className="dashboard-content">
        <div className="kpi-section">
          <div className="kpi-tile">
            <div className="kpi-value">{kpis.today}</div>
            <div className="kpi-label">Today's Enquiries</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{kpis.available}</div>
            <div className="kpi-label">Available</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{kpis.unavailable}</div>
            <div className="kpi-label">Unavailable</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{kpis.percentAvailable}%</div>
            <div className="kpi-label">% Available</div>
          </div>
        </div>

        <div className="filters-section">
          <input
            type="text"
            placeholder="Search by client name, yacht, or reference..."
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            className="search-input"
          />
          <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="filter-select">
            <option value="">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Available">Available</option>
            <option value="OnHold">On Hold</option>
            <option value="Booked">Booked</option>
            <option value="CapacityExceeded">Capacity Exceeded</option>
          </select>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Loading enquiries...</div>
        ) : enquiries.length === 0 ? (
          <div className="empty-state">No enquiries found</div>
        ) : (
          <>
            <div className="enquiries-table">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Client</th>
                    <th>Yacht</th>
                    <th>Dates</th>
                    <th>Guests</th>
                    <th>Status</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map((enquiry, idx) => (
                    <tr key={idx}>
                      <td className="reference">{enquiry.reference}</td>
                      <td>{enquiry.clientName}</td>
                      <td>{enquiry.yachtName}</td>
                      <td className="dates">
                        {formatDate(enquiry.startDate)} – {formatDate(enquiry.endDate)}
                      </td>
                      <td className="guests">{enquiry.guests}</td>
                      <td>
                        <span className={getStatusBadgeClass(enquiry.status)}>{enquiry.status}</span>
                      </td>
                      <td className="date">{formatDate(enquiry.receivedDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button onClick={() => loadEnquiries(page - 1)} disabled={page <= 1}>
                Previous
              </button>
              <span>
                Page {page} of {Math.ceil(total / 10)}
              </span>
              <button onClick={() => loadEnquiries(page + 1)} disabled={page >= Math.ceil(total / 10)}>
                Next
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
