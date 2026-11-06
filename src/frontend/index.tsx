import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EnquiryPage from './pages/EnquiryPage';
import ConfirmationPage from './pages/ConfirmationPage';
import BrokerDashboardPage from './pages/BrokerDashboardPage';
import './styles/index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/charter/enquiry" element={<EnquiryPage />} />
        <Route path="/charter/enquiry/:reference" element={<ConfirmationPage />} />
        <Route path="/broker/enquiries" element={<BrokerDashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
