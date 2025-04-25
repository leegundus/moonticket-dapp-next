import { useEffect, useState } from "react";

export default function PastDrawings() {
  const [draws, setDraws] = useState([]);

  useEffect(() => {
    const fetchDraws = async () => {
      const res = await fetch("/api/pastDraws");
      const data = await res.json();
      setDraws(data);
    };

    fetchDraws();
  }, []);

  return (
    <div className="bg-black text-yellow-400 min-h-screen px-6 pt-40 pb-6 overflow-x-hidden">
      <h1 className="text-2xl font-bold mb-4">Past Drawings</h1>

      {draws.length === 0 ? (
        <p>No draws yet.</p>
      ) : (
        <ul className="space-y-4">
          {draws.map((draw) => (
            <li key={draw.id} className="border p-4 border-yellow-600 rounded max-w-full overflow-hidden">
              <p><strong>Date:</strong> {new Date(draw.draw_date).toLocaleString()}</p>
              <p className="break-all"><strong>Winner:</strong> {draw.rolled_over ? "None (Rolled Over)" : draw.winner}</p>
              <p><strong>Jackpot:</strong> {(draw.jackpot_sol * 0.8).toFixed(2)} SOL</p>
              <p><strong>Entries:</strong> {draw.entries}</p>
              <p>
                <strong>Transaction:</strong>{" "}
                <a
                  href={`https://solscan.io/tx/${draw.tx_signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-400 break-all"
                >
                  View on Solscan
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
