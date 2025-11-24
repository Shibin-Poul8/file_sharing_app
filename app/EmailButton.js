'use client';

export default function EmailButton() {
  const sendEmail = async () => {
    const res = await fetch('/api/send', { method: 'POST' });
    const data = await res.json();
    alert(data.success ? 'Email sent!' : 'Failed to send');
  };

  return (
    <button
      onClick={sendEmail}
      style={{
        background: '#0070f3',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      Send Test Email
    </button>
  );
}
