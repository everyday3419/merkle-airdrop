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

    pub fn initialize(ctx: Context<Initialize>, root: [u8; 32]) -> Result<()> {
        initialize::handler(ctx, root)
    }
}
