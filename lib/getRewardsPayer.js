const { Keypair } = require("@solana/web3.js");
const bs58 = require("bs58");

const secret = process.env.REWARDS_SECRET_KEY_BASE58;
const payer = Keypair.fromSecretKey(bs58.decode(secret));

module.exports = () => payer;
