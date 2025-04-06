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
    <div className="bg-black text-yellow-400 min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Past Drawings</h1>

      {draws.length === 0 ? (
        <p>No draws yet.</p>
      ) : (
        <ul className="space-y-4">
          {draws.map((draw) => (
            <li key={draw.id} className="border p-4 border-yellow-600 rounded">
              <p><strong>Date:</strong> {new Date(draw.draw_date).toLocaleString()}</p>
              <p><strong>Winner:</strong> {draw.rolled_over ? "None (Rolled Over)" : draw.winner}</p>
              <p><strong>Jackpot:</strong> {draw.jackpot_sol} SOL</p>
              <p><strong>Entries:</strong> {draw.entries}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
