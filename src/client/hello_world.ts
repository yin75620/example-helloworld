/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Account,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';
import * as BufferLayout from '@solana/buffer-layout';


import {
  getPayer,
  getRpcUrl,
  newAccountWithLamports,
  readAccountFromFile,
} from './utils';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Account (keypair)
 */
let payerAccount: Account;

/**
 * Hello world's program id
 */
let programId: PublicKey;

/**
 * The public key of the account we are saying hello to
 */
let greetedPubkey: PublicKey;

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../../dist/program');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running either:
 *   - `npm run build:program-c`
 *   - `npm run build:program-rust`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'helloworld.so');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/helloworld.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'helloworld-keypair.json');
const ACCOUNT1_PATH = "/Users/jeffyin/breakthrough/solana/example-helloworld/keys/1a11oX3ak4hmeLrmaoaZdLY911hKHYjEYXxPd9LobVS.json"; 
//const PROGRAM_RUST_PATH = path.resolve(__dirname, '../../src/program-rust/target/deploy')
//const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_RUST_PATH, 'helloworld-keypair.json');

/**
 * The state of a greeting account managed by the hello world program
 */
class GreetingAccount {
  counter = 0;
  randnum = 0;
  constructor(fields: {counter: number, randnum: number} | undefined = undefined) {
    if (fields) {
      this.counter = fields.counter;
      this.randnum = fields.randnum;
    }
  }
}

/**
 * Borsh schema definition for greeting accounts
 */
const GreetingSchema = new Map([
  [GreetingAccount, {kind: 'struct', fields: [['counter', 'u32'],['randnum', 'u32']]}],
]);

/**
 * The expected size of each greeting account.
 */
const GREETING_SIZE = borsh.serialize(
  GreetingSchema,
  new GreetingAccount(),
).length;


class EnterData {
  instration = 0;
  constructor(fields: {instration: number} | undefined = undefined) {
    if (fields) {
      this.instration = fields.instration;
    }
  }
}
/**
 * Borsh schema definition for greeting accounts
 */
 const EnterSchema = new Map([
  [EnterData, {kind: 'struct', fields: [['instration', 'u8']]}],
]);
/**
 * The expected size of each greeting account.
 */
 const ENTER_DATA_SIZE = borsh.serialize(
  EnterSchema,
  new EnterData(),
).length;


/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
}

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
  let fees = 0;
  if (!payerAccount) {
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to fund the greeter account
    fees += await connection.getMinimumBalanceForRentExemption(GREETING_SIZE);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag
    console.log("fees:", fees);

    try {
      // Get payer from cli config
      payerAccount = await getPayer();
    } catch (err) {
      // Fund a new payer via airdrop
      payerAccount = await newAccountWithLamports(connection, fees);
    }
  }
  
  const lamports = await connection.getBalance(payerAccount.publicKey);
  if (lamports < fees) {
    // This should only happen when using cli config keypair
    const sig = await connection.requestAirdrop(
      payerAccount.publicKey,
      fees - lamports,
    );
    await connection.confirmTransaction(sig);
  }

  console.log(
    'Using account',
    payerAccount.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'SOL to pay for fees',
  );
}

/**
 * Check if the hello world BPF program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programAccount = await readAccountFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programAccount.publicKey;
    console.log("programId:", programId.toBase58())

    var programId2 = new PublicKey(programId.toBase58());
    console.log("programId2:",programId2.toBase58());
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/helloworld.so\``,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed with `solana program deploy dist/program/helloworld.so`',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}`);

  // Derive the address of a greeting account from the program so that it's easy to find later.
  const GREETING_SEED = 'hello';
  greetedPubkey = await PublicKey.createWithSeed(
    payerAccount.publicKey,
    GREETING_SEED,
    programId,
  );
  console.log(`jtest$ payerAccount.publicKey ${payerAccount.publicKey.toBase58()}`);

  // Check if the greeting account has already been created
  const greetedAccount = await connection.getAccountInfo(greetedPubkey);
  if (greetedAccount === null) {
    console.log(
      'Creating account',
      greetedPubkey.toBase58(),
      'to say hello to',
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      GREETING_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payerAccount.publicKey,
        basePubkey: payerAccount.publicKey,
        seed: GREETING_SEED,
        newAccountPubkey: greetedPubkey,
        lamports,
        space: GREETING_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payerAccount]);
  }
}

export async function sendMoney(): Promise<void> {
     // Send game funds
     var amount = 0.01
     console.log("Amount:" + amount)
     console.log("Sending to greetedPubkey: ");
     console.log(greetedPubkey.toBase58());
     const transaction = new Transaction().add(SystemProgram.transfer({
         fromPubkey: payerAccount.publicKey,
         toPubkey: greetedPubkey,
         lamports: amount * LAMPORTS_PER_SOL,
     }));

     await sendAndConfirmTransaction(
      connection,
      transaction,
      [payerAccount],
    );
}

import * as web3 from "@solana/web3.js";
import * as splToken from "@solana/spl-token";

export async function sendToken(): Promise<void> {
  //(async () => {
    // Connect to cluster
    var connection = new web3.Connection(web3.clusterApiUrl("devnet"));
    // Construct wallet keypairs
    //var payerAccount = await getPayer();
    let senderAccount = await readAccountFromFile(ACCOUNT1_PATH);
    console.time("Hi");
    var fromWallet = senderAccount; //web3.Keypair.fromSecretKey(DEMO_WALLET_SECRET_KEY);

    //var toWallet = web3.Keypair.generate();
    var toWalletPublickKey = new PublicKey("2acs4mPoLyweRu1ANC1st9Rd2G3EheA7G4Cr5rLiq3G1");

    // Construct my token class
    var myMint = new web3.PublicKey("xxVzGsfDVaQvd5eTkCuyJFaAhTzDNAXnW49r5kNLKKN");//("My Mint Public Address");
    var myToken = new splToken.Token(
      connection,
      myMint,
      splToken.TOKEN_PROGRAM_ID,
      fromWallet
    );
    console.timeLog("Hi");
    // Create associated token accounts for my token if they don't exist yet
    var fromTokenAccount = await myToken.getOrCreateAssociatedAccountInfo(
      fromWallet.publicKey
    )
    var toTokenAccount = await myToken.getOrCreateAssociatedAccountInfo(
      //toWallet.publicKey
      toWalletPublickKey
    )
    console.timeLog("Hi");
    console.log(splToken.TOKEN_PROGRAM_ID);
    // Add token transfer instructions to transaction
    var transaction = new web3.Transaction()
      .add(
        splToken.Token.createTransferInstruction(
          splToken.TOKEN_PROGRAM_ID,
          fromTokenAccount.address,
          toTokenAccount.address,
          fromWallet.publicKey,
          [],
          10 //amount
        )
      );
    // Sign transaction, broadcast, and confirm
    var signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [fromWallet]
    );

    console.timeEnd("Hi");
    
    console.log("SIGNATURE", signature);
    console.log("SUCCESS");
  //})();
}

export async function createTokenATA(): Promise<void>{
  let programAccount = await readAccountFromFile(PROGRAM_KEYPAIR_PATH); 
  // Main Address 7ya4jC952z5m3bZdCNTL6BbLVTquGzr3S4CXZtkKBXMt
  // xx Token Address CPr4F3m3GpHKJSr7FUEBUuXZCrDZUBBW1uYpo5pmBvTL
  
  
  var connection = new web3.Connection(web3.clusterApiUrl("devnet"));
  // Construct wallet keypairs
  let senderAccount = await readAccountFromFile(ACCOUNT1_PATH);
  console.time("Hi");
  var fromWallet = senderAccount;

  var toWalletPublickKey = programAccount.publicKey;
  // Construct my token class
  var myMint = new web3.PublicKey("xxVzGsfDVaQvd5eTkCuyJFaAhTzDNAXnW49r5kNLKKN");//("My Mint Public Address");
  var myToken = new splToken.Token(
    connection,
    myMint,
    splToken.TOKEN_PROGRAM_ID,
    fromWallet
  );

  // Create associated token accounts for my token if they don't exist yet
  var fromTokenAccount = await myToken.getOrCreateAssociatedAccountInfo(
    fromWallet.publicKey
  )
  var toTokenAccount = await myToken.getOrCreateAssociatedAccountInfo(
    //toWallet.publicKey
    toWalletPublickKey
  )

  // Add token transfer instructions to transaction
  var transaction = new web3.Transaction()
  .add(
    splToken.Token.createTransferInstruction(
      splToken.TOKEN_PROGRAM_ID,
      fromTokenAccount.address,
      toTokenAccount.address,
      fromWallet.publicKey,
      [],
      10 //amount
    )
  );
  // Sign transaction, broadcast, and confirm
  var signature = await web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [fromWallet]
  );

  console.log("SUCCESS");

}

export async function sendTokenByMyContract(): Promise<void> {

  // Construct wallet keypairs
  let account1 = await readAccountFromFile(ACCOUNT1_PATH);

  

  

  var data = createSayHelloInstructionData(1);

  const instruction = new TransactionInstruction({
    keys: [//{pubkey: greetedPubkey, isSigner: false, isWritable: true},
      //{pubkey: sysvarClockPubKey, isSigner: false, isWritable: false},
      {pubkey: account1.publicKey, isSigner: true, isWritable: true},
      //{pubkey: payerAccount.publicKey, isSigner: true, isWritable: true},
      //{pubkey: token_address, isSigner: false, isWritable: false},
      //{pubkey: authorityAccount, isSigner:false, isWritable:false},
      //{pubkey: programTokenAccount, isSigner:false, isWritable:false},
      //{pubkey: userTokenAccount, isSigner:false, isWritable:false},
    ],
    programId,
    data: data, // All instructions are hellos
  });
  console.log("SUCCESS");

  var tx = new Transaction();
  /*tx.add(SystemProgram.transfer({
    fromPubkey: payerAccount.publicKey,
    toPubkey: greetedPubkey,
    lamports: 0.01 * LAMPORTS_PER_SOL,
  }));*/
  tx.add(instruction);
  tx.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;
  tx.feePayer = account1.publicKey;

  tx.sign(account1);

    await sendAndConfirmTransaction(
      connection,
      tx,
      [account1],
    );
  
}

function createSayHelloInstructionData( type : number): Buffer {
  const dataLayout = BufferLayout.struct([
    BufferLayout.u8('instruction'),
  ])

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode({
    instruction: type
  }, data);
  return data
}

/**
 * Say hello
 */
export async function sayHello(): Promise<void> {
  console.log('Saying hello to', greetedPubkey.toBase58());
  let sysvarClockPubKey = new PublicKey('SysvarC1ock11111111111111111111111111111111');
  let token_address = new PublicKey('xxVzGsfDVaQvd5eTkCuyJFaAhTzDNAXnW49r5kNLKKN');
  //let authorityAccount = new PublicKey('8kTX4Q4itv5hwTsMUkPjVF7ECDVxSCNssSHNGtfbb9Pn'); //
  let authorityAccount = new PublicKey('5g66nv9DQMRpxJeouFGr1497g4jVdnXeLowawzbkXxjb'); //
  let programTokenAccount = new PublicKey('69aSHjgpnP8w1JtdupamzVwM9Rjx1kKq69JCMxFCut6V')
  let userAccount = await readAccountFromFile(ACCOUNT1_PATH);
  let userTokenAccount = new PublicKey('Aw34RrJ4vJ966Rgbya7ehSX2LoS2ueMCmGDZ7DztDrcq');
  console.log("userPubKey:", userAccount.publicKey.toBase58());
  //let fundPubkey = payerAccount.publicKey;
  const instruction = new TransactionInstruction({
    keys: [{pubkey: greetedPubkey, isSigner: false, isWritable: true},
      {pubkey: sysvarClockPubKey, isSigner: false, isWritable: false},
      {pubkey: userAccount.publicKey, isSigner: true, isWritable: true},
      {pubkey: payerAccount.publicKey, isSigner: true, isWritable: true},
      {pubkey: token_address, isSigner: false, isWritable: false},
      {pubkey: authorityAccount, isSigner:false, isWritable:false},
      {pubkey: programTokenAccount, isSigner:false, isWritable:false},
      {pubkey: userTokenAccount, isSigner:false, isWritable:false},
    ],
    programId,
    //data: Buffer.alloc(0), // All instructions are hellos
    data: createSayHelloInstructionData(1),
  });

  var tx = new Transaction();
  tx.add(SystemProgram.transfer({
    fromPubkey: payerAccount.publicKey,
    toPubkey: greetedPubkey,
    lamports: 0.01 * LAMPORTS_PER_SOL,
  }));
  tx.add(instruction);
  tx.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;
  tx.feePayer = payerAccount.publicKey;

  tx.sign(userAccount,payerAccount);
  //tx.sign(userAccount,payerAccount);

  const acc = "vFj/mjPXxWxMoVxwBpRfHKufaxK0RYy3Gd2rAmKlveF7oiinGDnsXlRSbXieC5x6prka4aQGE8tFRz17zLl38w==";
  const treasuryAccount = new Account(Buffer.from(acc, "base64"));
  console.log("jtest$ treasury:", treasuryAccount.publicKey.toBase58());
  
  

  
  await sendAndConfirmTransaction(
    connection,
    tx,
    [payerAccount,userAccount],
  );
}

/**
 * Report the number of times the greeted account has been said hello to
 */
export async function reportGreetings(): Promise<void> {
  const accountInfo = await connection.getAccountInfo(greetedPubkey);
  if (accountInfo === null) {
    throw 'Error: cannot find the greeted account';
  }
  const greeting = borsh.deserialize(
    GreetingSchema,
    GreetingAccount,
    accountInfo.data,
  );
  console.log(
    greetedPubkey.toBase58(),
    'has been greeted',
    greeting.counter,
    'time(s)',
    'Random Number:',
    greeting.randnum,
  );
}
