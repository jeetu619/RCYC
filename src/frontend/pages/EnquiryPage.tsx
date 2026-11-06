import React from 'react';
import EnquiryForm from '../components/EnquiryForm';

export default function EnquiryPage() {
  return (
    <div className="page enquiry-page">
      <header className="page-header">
        <h1>Charter Your Yacht</h1>
        <p>Complete your enquiry in a few steps</p>
      </header>
      <main>
        <EnquiryForm />
      </main>
    </div>
  );
}
