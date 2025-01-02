pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("AfZt7zP6v3sBh4JjyjuEvmf4iRnhkaK8xYiim4tkZMAj");

#[program]
pub mod solana_airdrop {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, root: [u8; 32], stock: u64) -> Result<()> {
        initialize::initialize_handler(ctx, root, stock)
    }

    pub fn claim(ctx: Context<Claim>, proof: Vec<[u8; 32]>, amount: u64) -> Result<()> {
        claim::claim_handler(ctx, proof, amount)
    }

    pub fn withdraw_and_close_vault(ctx: Context<WithdrawAndCloseVault>) -> Result<()> {
        withdraw_and_close_vault::withdraw_and_close_vault_handler(ctx)
    }
}
