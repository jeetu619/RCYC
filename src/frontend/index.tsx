import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import EnquiryPage from './pages/EnquiryPage';
import ConfirmationPage from './pages/ConfirmationPage';
import BrokerDashboardPage from './pages/BrokerDashboardPage';
import './styles/index.css';

function NotFound() {
  return (
    <div className="page">
      <main id="main" className="confirmation-content">
        <h1>Page not found</h1>
        <Link className="btn btn-primary" to="/charter/enquiry">
          Start a charter enquiry
        </Link>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main">Skip to content</a>
      <Routes>
        <Route path="/" element={<Navigate to="/charter/enquiry" replace />} />
        <Route path="/charter/enquiry" element={<EnquiryPage />} />
        <Route path="/charter/enquiry/:reference" element={<ConfirmationPage />} />
        <Route path="/broker/enquiries" element={<BrokerDashboardPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
