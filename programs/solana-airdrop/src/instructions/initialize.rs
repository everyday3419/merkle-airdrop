use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::Airdrop;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub token: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = token,
        associated_token::authority = signer,
        associated_token::token_program = token_program
    )]
    pub signer_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = signer,
        space = 8 + Airdrop::INIT_SPACE,
        seeds = [b"airdrop", signer.key().as_ref(), token.key().as_ref()],
        bump
    )]
    pub airdrop: Box<Account<'info, Airdrop>>,

    #[account(
        init,
        payer = signer,
        associated_token::mint = token,
        associated_token::authority = airdrop,
        associated_token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_handler(ctx: Context<Initialize>, root: [u8; 32], stock: u64) -> Result<()> {
    let airdrop = &mut ctx.accounts.airdrop;
    airdrop.token = ctx.accounts.token.key();
    airdrop.root = root;
    airdrop.bump = ctx.bumps.airdrop;

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.signer_token_account.to_account_info(),
        mint: ctx.accounts.token.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.signer.to_account_info(),
    };

    let cpi_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
    );

    transfer_checked(cpi_context, stock, ctx.accounts.token.decimals)?;

    Ok(())
}
