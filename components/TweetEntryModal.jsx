import { useState } from 'react';
import Modal from './Modal';
import { useWallet } from '@solana/wallet-adapter-react';

export default function TweetEntryModal({ isOpen, onClose, isBonus = false }) {
  const { publicKey } = useWallet();
  const [tweetUrl, setTweetUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const tweetText = encodeURIComponent(
    `I got my TIX to the moon for this week, go get yours!\nhttps://moonticket.io #Moonticket #Solana #TIX ${isBonus ? '#bonustix' : '#freetix'} @moonticket__io`
  );
  const tweetLink = `https://twitter.com/intent/tweet?text=${tweetText}`;

  const handleSubmit = async () => {
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/claimFreeEntry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey?.toBase58(),
          tweetUrl,
          isBonus,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setMessage('Entry successfully claimed!');
      } else {
        setMessage(result.error || 'Failed to claim entry.');
      }
    } catch (err) {
      setMessage('Unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isBonus ? 'Bonus Entry' : 'Claim Free Entry'}>
      <div className="p-4">
        <a
          href={tweetLink}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 text-white px-4 py-2 rounded mb-4 inline-block"
        >
          Tweet Now
        </a>

        <input
          type="text"
          className="w-full border bg-white text-black px-3 py-2 mb-3"
          placeholder="Paste your tweet URL here..."
          value={tweetUrl}
          onChange={(e) => setTweetUrl(e.target.value)}
          onInput={(e) => setTweetUrl(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          disabled={submitting || !tweetUrl || !publicKey}
          className="bg-yellow-500 text-black px-4 py-2 rounded disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Claim Entry'}
        </button>

        {message && (
          <p className="mt-3 text-center text-sm text-white">
            {message}
          </p>
        )}
      </div>
    </Modal>
  );
}
