use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{error::ErrorCode, Airdrop};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    #[account(mint::token_program = token_program)]
    pub token: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = token,
        associated_token::authority = recipient,
        associated_token::token_program = token_program
    )]
    pub recipient_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
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

pub fn claim_handler(ctx: Context<Claim>, proof: Vec<[u8; 32]>, amount: u64) -> Result<()> {
    let root = ctx.accounts.airdrop.root;

    let leaf: [u8; 32] = keccak::hashv(&[
        &ctx.accounts.recipient.key().to_bytes(),
        &amount.to_le_bytes(),
    ])
    .0;

    let mut computed_hash = leaf;
    for p in proof.iter() {
        if computed_hash <= *p {
            computed_hash = keccak::hashv(&[&computed_hash, p]).0;
        } else {
            computed_hash = keccak::hashv(&[p, &computed_hash]).0;
        }
    }

    require!(computed_hash == root, ErrorCode::InvalidMerkleProof);

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
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.airdrop.to_account_info(),
    };

    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
        signer_seeds,
    );

    transfer_checked(cpi_context, amount, ctx.accounts.token.decimals)?;

    Ok(())
}
