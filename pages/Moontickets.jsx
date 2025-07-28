import React, { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token";

const TIX_MINT = new PublicKey("Your_TIX_Mint_Address");
const TREASURY_WALLET = new PublicKey("FrAvtjXo5JCsWrjcphvWCGQDrXX8PuEbN2qu2SGdvurG");
const TIX_PRICE_USD = 0.0001;
const ENTRY_PRICE_USD = 1;
const ENTRY_PRICE_TIX = ENTRY_PRICE_USD / TIX_PRICE_USD; // 10,000 TIX per ticket

export default function Moontickets() {
    const { publicKey, sendTransaction } = useWallet();
    const [selectedNumbers, setSelectedNumbers] = useState([]);
    const [moonBall, setMoonBall] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [message, setMessage] = useState("");

    const toggleNumber = (num) => {
        if (selectedNumbers.includes(num)) {
            setSelectedNumbers(selectedNumbers.filter((n) => n !== num));
        } else {
            if (selectedNumbers.length < 4) {
                setSelectedNumbers([...selectedNumbers, num]);
            }
        }
    };

    const autoPick = () => {
        const nums = [];
        while (nums.length < 4) {
            const n = Math.floor(Math.random() * 25) + 1;
            if (!nums.includes(n)) nums.push(n);
        }
        setSelectedNumbers(nums);
        setMoonBall(Math.floor(Math.random() * 10) + 1);
    };

    const addTicket = () => {
        if (selectedNumbers.length !== 4 || !moonBall) {
            setMessage("Select 4 numbers and a moon ball before adding.");
            return;
        }
        const newTicket = { numbers: [...selectedNumbers], moonBall };
        setTickets([...tickets, newTicket]);
        setSelectedNumbers([]);
        setMoonBall(null);
        setMessage("Ticket added!");
    };

    const purchaseTickets = async () => {
        if (!publicKey) {
            setMessage("Connect your wallet first.");
            return;
        }
        if (tickets.length === 0) {
            setMessage("Add at least one ticket.");
            return;
        }
        try {
            setMessage("Processing purchase...");
            const ata = await getAssociatedTokenAddress(TIX_MINT, publicKey);
            const treasuryAta = await getAssociatedTokenAddress(TIX_MINT, TREASURY_WALLET);
            const tx = new Transaction();
            tx.add(
                createTransferInstruction(
                    ata,
                    treasuryAta,
                    publicKey,
                    ENTRY_PRICE_TIX * tickets.length * 1e6, // TIX has 6 decimals
                    [],
                    TOKEN_PROGRAM_ID
                )
            );
            const sig = await sendTransaction(tx, { skipPreflight: false });
            setMessage(`Transaction sent: ${sig}`);

            // Log entries in Supabase
            const res = await fetch("/api/powerballEntry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    wallet: publicKey.toBase58(),
                    tickets: tickets,
                    entry_type: "purchase",
                    amount_usd: ENTRY_PRICE_USD * tickets.length,
                    tix_amount: ENTRY_PRICE_TIX * tickets.length,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage(`Tickets purchased! ${tickets.length} entries submitted.`);
                setTickets([]);
            } else {
                setMessage("Error logging tickets.");
            }
        } catch (err) {
            console.error(err);
            setMessage("Transaction failed.");
        }
    };

    return (
        <div className="bg-black text-yellow-400 min-h-screen flex flex-col items-center justify-center p-4">
            <h1 className="text-3xl mb-4">Moonticket Powerball</h1>

            <div className="mb-4">
                <button onClick={autoPick} className="bg-yellow-400 text-black px-4 py-2 rounded">Auto Pick</button>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-4">
                {Array.from({ length: 25 }, (_, i) => i + 1).map((num) => (
                    <button
                        key={num}
                        onClick={() => toggleNumber(num)}
                        className={`w-12 h-12 rounded-full ${
                            selectedNumbers.includes(num) ? "bg-yellow-400 text-black" : "bg-gray-700"
                        }`}
                    >
                        {num}
                    </button>
                ))}
            </div>

            <div className="mb-4">Pick your Moon Ball:</div>
            <div className="grid grid-cols-5 gap-2 mb-4">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                    <button
                        key={num}
                        onClick={() => setMoonBall(num)}
                        className={`w-12 h-12 rounded-full ${
                            moonBall === num ? "bg-yellow-400 text-black" : "bg-gray-700"
                        }`}
                    >
                        {num}
                    </button>
                ))}
            </div>

            <button onClick={addTicket} className="bg-yellow-400 text-black px-4 py-2 rounded mb-4">
                Add Ticket
            </button>

            <div className="mb-4">
                <h2 className="text-xl mb-2">Tickets in Cart: {tickets.length}</h2>
                {tickets.map((t, idx) => (
                    <div key={idx} className="mb-1">
                        #{idx + 1}: {t.numbers.join(", ")} + Moon {t.moonBall}
                    </div>
                ))}
            </div>

            <div className="mb-4">
                Total Cost: {ENTRY_PRICE_TIX * tickets.length} TIX ({tickets.length} x $1)
            </div>

            <button onClick={purchaseTickets} className="bg-yellow-400 text-black px-4 py-2 rounded">
                Purchase Tickets
            </button>

            {message && <div className="mt-4">{message}</div>}
        </div>
    );
}
