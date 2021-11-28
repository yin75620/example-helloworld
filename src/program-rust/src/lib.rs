use std::hash::{Hash as StdHash, Hasher};
use std::collections::hash_map::DefaultHasher;
fn hash_value<T>(obj: T) -> u64
where
    T: StdHash,
{
    let mut hasher = DefaultHasher::new();
    obj.hash(&mut hasher);
    hasher.finish()
}
pub mod instruction;
use crate::instruction::HelloInstruction;


use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{
        clock::Clock, /*slot_hashes::SlotHashes,*/ Sysvar,
    },
};
use solana_program::{
    
    program::{invoke, invoke_signed},
};



/// Define the type of state stored in accounts
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct GreetingAccount {
    /// number of greetings
    pub counter: u32,
    pub randnum: u32,
}

// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint's implementation
pub fn process_instruction(
    program_id: &Pubkey, // Public key of the account the hello world program was loaded into
    accounts: &[AccountInfo], // The account to say hello to
    _instruction_data: &[u8], // Ignored, all helloworld instructions are hellos
) -> ProgramResult {
    //https://dev.to/cogoo/solana-how-to-send-custom-instructions-via-instruction-data-4g9g
    let instruction = HelloInstruction::unpack(_instruction_data)?;
    msg!("Instruction: {:?}", instruction);
    match instruction {
        HelloInstruction::SayHello =>{
            my_test1(program_id, accounts, _instruction_data);
        }
        HelloInstruction::SayBye => {
            my_test2(program_id, accounts, _instruction_data);      
        }
    }
    msg!("End");
    Ok(())
}


// Sanity tests
#[cfg(test)]
mod test {
    use super::*;
    use solana_program::clock::Epoch;
    use std::mem;

    #[test]
    fn test_sanity() {
        let program_id = Pubkey::default();
        let key = Pubkey::default();
        let mut lamports = 0;
        let mut data = vec![0; mem::size_of::<u32>()];
        let owner = Pubkey::default();
        let account = AccountInfo::new(
            &key,
            false,
            true,
            &mut lamports,
            &mut data,
            &owner,
            false,
            Epoch::default(),
        );
        let instruction_data: Vec<u8> = Vec::new();

        let accounts = vec![account];

        assert_eq!(
            GreetingAccount::try_from_slice(&accounts[0].data.borrow())
                .unwrap()
                .counter,
            0
        );
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(
            GreetingAccount::try_from_slice(&accounts[0].data.borrow())
                .unwrap()
                .counter,
            1
        );
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(
            GreetingAccount::try_from_slice(&accounts[0].data.borrow())
                .unwrap()
                .counter,
            2
        );
    }
}

/// Transfers SPL Tokens
pub fn transfer_spl_tokens<'a>(
    source_info: &AccountInfo<'a>,
    destination_info: &AccountInfo<'a>,
    authority_info: &AccountInfo<'a>,
    amount: u64,
    spl_token_info: &AccountInfo<'a>,
) -> ProgramResult {
    let transfer_instruction = spl_token::instruction::transfer(
        &spl_token::id(),
        source_info.key,
        destination_info.key,
        authority_info.key,
        &[],
        amount,
    )
    .unwrap();

    invoke(
        &transfer_instruction,
        &[
            spl_token_info.clone(),
            authority_info.clone(),
            source_info.clone(),
            destination_info.clone(),
        ],
    )?;

    Ok(())
}



pub fn my_test1(
    program_id: &Pubkey, // Public key of the account the hello world program was loaded into
    accounts: &[AccountInfo], // The account to say hello to
    _instruction_data: &[u8], // Ignored, all helloworld instructions are hellos
) -> ProgramResult {
    msg!("my_test1 Hello");

    let accounts_iter = &mut accounts.iter();

    // Get the account to say hello to
    let account1 = next_account_info(accounts_iter)?;

    let spl_token_program = next_account_info(accounts_iter)?;

    let sourceAccount = next_account_info(accounts_iter)?;

    let authority = next_account_info(accounts_iter)?;

    let program = next_account_info(accounts_iter)?;
    

    msg!("account1:{}", account1.key);
    msg!("spl_token_program:{}", spl_token_program.key);
    msg!("sourceAccount:{}", sourceAccount.key);
    msg!("authority:{}", authority.key);
    msg!("program:{}", program.key);
    
    //let (authority_key, bump_seed) = Pubkey::find_program_address(
    //    &[&swap_account.key.to_bytes()[..]],
    //    &spl_token_swap::id(),
    //);
    let (authority_key, bump_seed) = Pubkey::find_program_address(
        &[&program.key.to_bytes()[..]],
        &program.key,
    );
    //let signers = &[&[&b"escrow"[..], &[bump_seed]]];
    
    let program_bytes = program.key.to_bytes();
    let authority_signature_seeds = [&program_bytes[..32], &[bump_seed]];
    let signers = &[&authority_signature_seeds[..]];
    
    let ix = spl_token::instruction::transfer(
        spl_token_program.key,
        sourceAccount.key, //source
        account1.key, //destination
        authority.key,
        &[],
        10,
    )?;
    invoke_signed(
        &ix,
        &[sourceAccount.clone(), account1.clone(), authority.clone(), program.clone()],
        signers,
    );

    

    /*let transfer_to_taker_ix = 
    spl_token::instruction::transfer( 
        token_program.key, 
        pdas_temp_token_account.key, t
        akers_token_to_receive_account.key, 
        &pda, 
        &[&pda], 1, )?;
        msg!("Calling the token program to transfer tokens to the taker..."); 
        invoke_signed( &transfer_to_taker_ix, 
            &[ pdas_temp_token_account.clone(), 
            takers_token_to_receive_account.clone(), 
            pda_account.clone(), token_program.clone(), 
            ], 
            &[&[&b"escrow"[..], &[nonce]]], 
        )?;*/

    Ok(())
}

pub fn my_test2(
    program_id: &Pubkey, // Public key of the account the hello world program was loaded into
    accounts: &[AccountInfo], // The account to say hello to
    _instruction_data: &[u8], // Ignored, all helloworld instructions are hellos
) -> ProgramResult{
    msg!("Hello World Rust program entrypoint");

    // Iterating accounts is safer then indexing
    let accounts_iter = &mut accounts.iter();

    // Get the account to say hello to
    let greeted_account = next_account_info(accounts_iter)?;

    // Get the time account
    let sysvar_clock_account = next_account_info(accounts_iter)?;

  
    let user_account = next_account_info(accounts_iter)?;
    let fund_account = next_account_info(accounts_iter)?;

    // Get Token Program
    let spl_token_program = next_account_info(accounts_iter)?;


    //Program Authority
    let authority_account = next_account_info(accounts_iter)?;

    let program_token_account = next_account_info(accounts_iter)?;
    let user_token_account = next_account_info(accounts_iter)?;
    
    // The account must be owned by the program in order to modify its data
    if greeted_account.owner != program_id {
        msg!("Greeted account does not have the correct program id");
        return Err(ProgramError::IncorrectProgramId);
    }
    
    if sysvar_clock_account.key.to_string() != "SysvarC1ock11111111111111111111111111111111" {
        msg!("sysvarClockPubkey account does not have the correct program id");
        return Err(ProgramError::InvalidAccountData);
    }

    /*let ix = spl_token::instruction::transfer(
        spl_token_program.key,
        source.key,
        destination.key,
        authority.key,
        &[],
        amount,
    )?;
    invoke_signed(
        &ix,
        &[source, destination, authority, token_program],
        signers,
    )*/

    let mut randnum = 0;
    // 傳送 spl-token
    /*let source_pubkey = program_token_account.key;
    let destination_pubkey = user_token_account.key;
    let authority_pubkey = authority_account.key;
    //let signer_pubkeys = &[];
    let spl_token_id = spl_token_program.key;
    let output_qty =  10u64;
    transfer_spl_tokens(
        program_token_account,
        user_token_account,
        authority_account,
        output_qty,
        spl_token_program,
    )?;*/
    /* 原始檔案用來對照名稱
        transfer_spl_tokens(
        governing_token_source_info,
        governing_token_holding_info,
        governing_token_transfer_authority_info,
        amount,
        spl_token_info,
    )?;*/

/*
    let authority_signer_seeds = &[
        program_token_account.key.as_ref(),
        &[program_token_account.bump_seed],
    ];

    // 傳送 spl-token
    let source_pubkey = program_token_account.key;
    let destination_pubkey = user_token_account.key;
    let authority_pubkey = authority_account.key;
    let signer_pubkeys = &[];
    let spl_token_id = spl_token_program.key;
    let output_qty =  10u64;
    let instruction = spl_token::instruction::transfer(
        &spl_token::ID,
        source_pubkey,
        destination_pubkey,
        authority_pubkey,
        signer_pubkeys,
        output_qty
            //.try_into()
            //.or(Err(ProgramError::InvalidArgument))?,
    )?;

    let account_infos = &[
        user_token_account.clone(),
        program_token_account.clone(),
        authority_account.clone(),
        spl_token_program.clone(),
    ];
    CpiAccount::new()

    program::invoke_signed(
        &instruction,
        account_infos,
        &[&[self.pool_account.key.as_ref(), &[state.vault_signer_nonce]]],
    )?;
    */
    //program::invoke(&instruction, account_infos)?;

    /*
    program::invoke_signed(
        &instruction,
        account_infos,
        &[&[greeted_account.key.as_ref(), &[state.vault_signer_nonce]]],
    )?;*/
    //---


    for a in 0..1 {
        let temp = Clock::from_account_info(sysvar_clock_account)?;
        let current_slot = temp.slot;
        

        let epoch_start_timestamp = temp.epoch_start_timestamp;
        let epoch = temp.epoch;
        let leader_schedule_epoch = temp.leader_schedule_epoch;
        let unix_timestamp = temp.unix_timestamp;
        msg!("{}, current_slot:{}, epoch_start_timestamp:{}, epoch:{}, leader_schedule_epoch:{}, unix_timestamp:{}",
         a, current_slot, epoch_start_timestamp, epoch, leader_schedule_epoch, unix_timestamp);

        let v = hash_value(current_slot);
        msg!("slot_hash:{}", v );
        randnum = v as u32;
        
        msg!("slot_hash:{}", hash_value(current_slot));

        msg!("account.lamports():{}", greeted_account.lamports());

        let test_amount = 1000 as u64;
        **greeted_account.lamports.borrow_mut() -= test_amount;
        **user_account.lamports.borrow_mut() += test_amount;
    }

    

    // Increment and store the number of times the account has been greeted
    for x in 0..1 {
        msg!("{}", x); // x: i32
        msg!("{}", hash_value(x-1));
        msg!("{}", hash_value("A"));
        

        //msg!("{:?}", str::from_utf8(&buf));
        
    
        let mut greeting_account = GreetingAccount::try_from_slice(&greeted_account.data.borrow())?;
        greeting_account.counter += 1;
        greeting_account.randnum = randnum;
        greeting_account.serialize(&mut &mut greeted_account.data.borrow_mut()[..])?;
        msg!("Greeted {} time(s)!", greeting_account.counter);
    }
    
    

    Ok(())
}