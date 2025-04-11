const { Keypair } = require("@solana/web3.js");

const secret = JSON.parse(process.env.TREASURY_PRIVATE_KEY); // your key as an array
const payer = Keypair.fromSecretKey(Uint8Array.from(secret));

module.exports = () => payer;
