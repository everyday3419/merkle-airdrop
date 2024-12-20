use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenInterface},
};

use crate::airdrop::Airdrop;

#[derive(Accounts)]
#[instruction(root: [u8; 32])]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub token: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = signer,
        space = 8 + Airdrop::INIT_SPACE,
        seeds = [b"airdrop", signer.key().as_ref(), root.as_ref(), token.key().as_ref()],
        bump
    )]
    pub airdrop: Account<'info, Airdrop>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, root: [u8; 32]) -> Result<()> {
    let airdrop = &mut ctx.accounts.airdrop;
    airdrop.token = ctx.accounts.token.key();
    airdrop.root = root;
    Ok(())
}
