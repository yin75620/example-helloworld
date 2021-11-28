// instruction.rs

use  solana_program::{program_error::ProgramError};

#[derive(Debug)]
pub enum HelloInstruction {
    SayHello,
    SayBye,
}

impl HelloInstruction {
  pub fn unpack( input: &[u8]) -> Result<Self,ProgramError> {
      let(&tag, rest) = input
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

      Ok(match tag {
        0 => HelloInstruction::SayHello,
        1 => HelloInstruction::SayBye,
        _ => return Err(ProgramError::InvalidInstructionData),
      })
  }
}