use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Airdrop {
    pub token: Pubkey,
    pub root: [u8; 32],
    pub bump: u8,
}
