use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

use crate::Airdrop;

#[derive(Accounts)]
pub struct WithdrawAndCloseVault<'info> {
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
        mut,
        close = signer,
        seeds = [b"airdrop", signer.key().as_ref(), token.key().as_ref()],
        bump = airdrop.bump
    )]
    pub airdrop: Box<Account<'info, Airdrop>>,

    #[account(
        mut,
        associated_token::mint = token,
        associated_token::authority = airdrop,
        associated_token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn withdraw_and_close_vault_handler(ctx: Context<WithdrawAndCloseVault>) -> Result<()> {
    let signer = ctx.accounts.signer.key();
    let token = ctx.accounts.token.key();

    let seeds = &[
        b"airdrop",
        signer.as_ref(),
        token.as_ref(),
        &[ctx.accounts.airdrop.bump],
    ];

    let signer_seeds = &[&seeds[..]];

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.vault.to_account_info(),
        mint: ctx.accounts.token.to_account_info(),
        to: ctx.accounts.signer_token_account.to_account_info(),
        authority: ctx.accounts.airdrop.to_account_info(),
    };

    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
        signer_seeds,
    );

    transfer_checked(
        cpi_context,
        ctx.accounts.vault.amount,
        ctx.accounts.token.decimals,
    )?;

    let accounts = CloseAccount {
        account: ctx.accounts.vault.to_account_info(),
        destination: ctx.accounts.signer.to_account_info(),
        authority: ctx.accounts.airdrop.to_account_info(),
    };

    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        accounts,
        signer_seeds,
    );

    close_account(cpi_context)
}
