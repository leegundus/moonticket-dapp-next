import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export default function CheckInButton() {
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleCheckIn = async () => {
    if (!publicKey) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: 'Check-in failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center mt-4">
      <button
        onClick={handleCheckIn}
        disabled={loading}
        className="bg-yellow-400 text-black font-bold py-2 px-6 rounded hover:bg-yellow-500"
      >
        {loading ? 'Checking in...' : 'Check In'}
      </button>

      {result?.tixAwarded && (
        <p className="mt-2 text-green-400">
          ✅ You earned {result.tixAwarded} TIX for your streak!
        </p>
      )}
      {result?.alreadyCheckedIn && (
        <p className="mt-2 text-blue-400">
          ✅ Already checked in today. Streak: {result.streak}
        </p>
      )}
      {result?.error && (
        <p className="mt-2 text-red-500">
          ❌ {result.error}
        </p>
      )}
    </div>
  );
}
