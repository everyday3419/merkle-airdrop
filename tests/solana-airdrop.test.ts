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
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const signer = web3.Keypair.generate();
  const users = Array.from({ length: 20 }, () => web3.Keypair.generate());
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
      2 * LAMPORTS_PER_SOL,
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

    const signerUsdcAccount = await getAssociatedTokenAddress(
      testToken,
      signer.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    try {
      await getAccount(connection, signerUsdcAccount, null, TOKEN_PROGRAM_ID);
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
      signerUsdcAccount,
      signer,
      50_000_000,
      [],
      null,
      TOKEN_PROGRAM_ID
    );
  });

  it("Airdrop initialization and claim", async () => {
    const program = anchor.workspace.SolanaAirdrop as Program<SolanaAirdrop>;

    const leaves = users.map((user, index) => {
      const amount = 500_000 + index * 10_000;
      return keccak256(
        Buffer.concat([
          user.publicKey.toBuffer(),
          Buffer.from(new anchor.BN(amount).toArray("le", 8)),
        ])
      );
    });

    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getRoot();

    const totalAirdropAmount = 50_000_000;
    let initTx: string | null = null;
    try {
      initTx = await program.methods
        .initialize(Array.from(root), new anchor.BN(totalAirdropAmount))
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

    expect(initTx).not.toBeNull();

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
      new anchor.BN(totalAirdropAmount)
    );

    for (let i = 0; i < 5; i++) {
      const user = users[i];
      const amount = 500_000 + i * 10_000;

      const leaf = keccak256(
        Buffer.concat([
          user.publicKey.toBuffer(),
          Buffer.from(new anchor.BN(amount).toArray("le", 8)),
        ])
      );

      const proof = tree.getProof(leaf).map((item) => Array.from(item.data));

      const userTokenAccount = await getAssociatedTokenAddress(
        testToken,
        user.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      let claimTx: string | null = null;
      try {
        claimTx = await program.methods
          .claim(proof, new anchor.BN(amount))
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

      expect(claimTx).not.toBeNull();
      expect(await getTokenBalance(connection, userTokenAccount)).toEqual(
        new anchor.BN(amount)
      );
    }
  });
});
