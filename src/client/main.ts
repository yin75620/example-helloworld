/**
 * Hello world
 */

import {
  establishConnection,
  establishPayer,
  checkProgram,
  sendMoney,
  sendToken,
  sendTokenByMyContract,
  createTokenATA,
  sayHello,
  reportGreetings,
} from './hello_world';

async function main() {
  //await main1();
  await test1();
  
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
async function test1(): Promise<void>{
  //await sendToken();
  //await createTokenATA();

  // Establish connection to the cluster
  await establishConnection();

   // Determine who pays for the fees
   await establishPayer();

   // Check if the program has been deployed
  await checkProgram();

  await sendTokenByMyContract();
  console.log('Success');
}

async function main1(): Promise<void> {
  console.log("Let's say hello to a Solana account...");

  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // Check if the program has been deployed
  await checkProgram();

  //await sendMoney();

  // Say hello to an account
  await sayHello();

  // Find out how many times that account has been greeted
  await reportGreetings();

  console.log('Success');
}
