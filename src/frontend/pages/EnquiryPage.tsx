import EnquiryForm from '../components/EnquiryForm';

export default function EnquiryPage() {
  return (
    <div className="page enquiry-page">
      <header className="page-header">
        <h1>Charter your yacht</h1>
        <p>Tell us about your trip in three short steps</p>
      </header>
      <main id="main">
        <EnquiryForm />
      </main>
    </div>
  );
}
