use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Custom error message")]
    CustomError,
    #[msg("Invalid merkle proof")]
    InvalidMerkleProof,
    #[msg("Invalid recipient")]
    RecipientMismatch,
}
