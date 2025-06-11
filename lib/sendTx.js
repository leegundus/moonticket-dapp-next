const { Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");

async function sendSignedTransaction(instructions, signer, connection) {
  const tx = new Transaction().add(...instructions);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  tx.recentBlockhash = blockhash;
  tx.feePayer = signer.publicKey;
  tx.sign(signer);

  return await sendAndConfirmTransaction(connection, tx, [signer], {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
    lastValidBlockHeight,
  });
}

module.exports = { sendSignedTransaction };
