import * as anchor from "@coral-xyz/anchor";
import crypto from "crypto";
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
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
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
      user.publicKey,
      1 * LAMPORTS_PER_SOL,
      1 * LAMPORTS_PER_SOL
    );

    testToken = await createMint(
      connection,
      user,
      user.publicKey,
      null,
      6,
      Keypair.generate(),
      null,
      TOKEN_PROGRAM_ID
    );

    const userUsdcAccount = await getAssociatedTokenAddress(
      testToken,
      user.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    try {
      await getAccount(connection, userUsdcAccount, null, TOKEN_PROGRAM_ID);
    } catch {
      await createAssociatedTokenAccount(
        connection,
        user,
        testToken,
        user.publicKey,
        null,
        TOKEN_PROGRAM_ID
      );
    }

    await mintTo(
      connection,
      user,
      testToken,
      userUsdcAccount,
      user,
      9_000_000,
      [],
      null,
      TOKEN_PROGRAM_ID
    );
  });

  it("Is initialized!", async () => {
    const program = anchor.workspace.SolanaAirdrop as Program<SolanaAirdrop>;
    const leaves = ["foo", "bar", "baz", "qux"].map((x) =>
      crypto.createHash("sha256").update(x).digest()
    );
    const tree = new MerkleTree(leaves, (data: crypto.BinaryLike) =>
      crypto.createHash("sha256").update(data).digest()
    );
    const root = tree.getRoot();

    let tx: string | null = null;
    try {
      tx = await program.methods
        .initialize(Array.from(root), new anchor.BN(9_000_000))
        .accounts({
          signer: user.publicKey,
          token: testToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
    } catch (e) {
      console.log(e);
    }

    expect(tx).not.toBeNull();
    const [airdropAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("airdrop"),
        user.publicKey.toBuffer(),
        root,
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
  });
});
