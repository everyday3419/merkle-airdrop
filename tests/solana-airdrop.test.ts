import * as anchor from "@coral-xyz/anchor";
import { keccak256 } from "js-sha3";
import { Program, web3 } from "@coral-xyz/anchor";
import MerkleTree from "merkletreejs";
import { SolanaAirdrop } from "../target/types/solana_airdrop";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { airdropIfRequired } from "@solana-developers/helpers";
import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("solana-airdrop", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const signer = web3.Keypair.generate();
  const user = web3.Keypair.generate();
  let testToken: PublicKey;

  const getTokenBalance = async (
    connection: Connection,
    tokenAccountAddress: PublicKey
  ): Promise<anchor.BN> => {
    const tokenBalance = await connection.getTokenAccountBalance(
      tokenAccountAddress
    );
    return new anchor.BN(tokenBalance.value.amount);
  };

  beforeAll(async () => {
    await airdropIfRequired(
      connection,
      signer.publicKey,
      1 * LAMPORTS_PER_SOL,
      1 * LAMPORTS_PER_SOL
    );

    testToken = await createMint(
      connection,
      signer,
      signer.publicKey,
      null,
      6,
      Keypair.generate(),
      null,
      TOKEN_PROGRAM_ID
    );

    const userUsdcAccount = await getAssociatedTokenAddress(
      testToken,
      signer.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    try {
      await getAccount(connection, userUsdcAccount, null, TOKEN_PROGRAM_ID);
    } catch {
      await createAssociatedTokenAccount(
        connection,
        signer,
        testToken,
        signer.publicKey,
        null,
        TOKEN_PROGRAM_ID
      );
    }

    await mintTo(
      connection,
      signer,
      testToken,
      userUsdcAccount,
      signer,
      9_000_000,
      [],
      null,
      TOKEN_PROGRAM_ID
    );
  });

  it("Is initialized!", async () => {
    const program = anchor.workspace.SolanaAirdrop as Program<SolanaAirdrop>;
    const leaf = keccak256(
      Buffer.concat([
        user.publicKey.toBuffer(),
        Buffer.from(new anchor.BN(9_000_000).toArray("le", 8)),
      ])
    );
    const leaves = [leaf];
    const tree = new MerkleTree(leaves, keccak256);
    const root = tree.getRoot();

    const proof = tree.getProof(leaves[0]);

    let tx: string | null = null;
    try {
      tx = await program.methods
        .initialize(Array.from(root), new anchor.BN(9_000_000))
        .accounts({
          signer: signer.publicKey,
          token: testToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([signer])
        .rpc();
    } catch (e) {
      console.log(e);
    }

    expect(tx).not.toBeNull();
    const [airdropAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("airdrop"),
        signer.publicKey.toBuffer(),
        testToken.toBuffer(),
      ],
      program.programId
    );
    const aidrop = await program.account.airdrop.fetch(airdropAddress);

    expect(Buffer.from(aidrop.root)).toEqual(root);

    const vault = getAssociatedTokenAddressSync(
      testToken,
      airdropAddress,
      true,
      TOKEN_PROGRAM_ID
    );

    expect(await getTokenBalance(connection, vault)).toEqual(
      new anchor.BN(9_000_000)
    );

    const formattedProof = proof.map((item) => Array.from(item.data));

    let tx1: string | null = null;
    try {
      tx1 = await program.methods
        .claim(formattedProof, new anchor.BN(9_000_000))
        .accounts({
          signer: signer.publicKey,
          recipient: user.publicKey,
          token: testToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([signer])
        .rpc();
    } catch (e) {
      console.log(e);
    }

    expect(tx1).not.toBeNull();
  });
});
