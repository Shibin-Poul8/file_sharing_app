'use client';
import { useState } from 'react';

export default function FileEmailForm() {
  const [file, setFile] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !recipient) return alert('Please provide both file and email');

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('recipient', recipient);

    const res = await fetch('/api/send', { method: 'POST', body: formData });
    const data = await res.json();
    setLoading(false);

    alert(data.success ? '✅ Email sent!' : '❌ Failed to send');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Recipient email"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        required
      />
      <input type="file" onChange={(e) => setFile(e.target.files[0])} required />
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send File via Email'}
      </button>
    </form>
  );
}
