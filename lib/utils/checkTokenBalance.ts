// lib/utils/checkTokenBalance.ts
export type TokenCheckResult = {
  ok: boolean;
  balanceHuman: number;
  requested: number;
  error?: string;
};

export async function checkTokenBalance(
  walletAddress: string,
  tokenAddress: string,
  tokenName: string,
  requestedValue: string
): Promise<TokenCheckResult> {
  try {
    console.log("checkTokenBalance: checking balance for token", {
      walletAddress,
      tokenAddress,
      tokenName,
      requestedValue,
    });
    // 1. Fetch portfolio tokens
    const res = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/api/portfolio/tokens?address=${walletAddress}`
    );
    if (!res.ok) {
      console.error("Failed to fetch portfolio");
      return {
        ok: false,
        balanceHuman: 0,
        requested: Number(requestedValue),
        error: "Failed to fetch portfolio",
      };
    }

    const { tokens } = (await res.json()) as { tokens: any[] };

    // 2. Find matching token
    const tokenData = tokens.find(
      (t) => t.token_address.toLowerCase() === tokenAddress.toLowerCase()
    );

    if (!tokenData) {
      console.error("No balance found for token", tokenName, tokenAddress);
      return {
        ok: false,
        balanceHuman: 0,
        requested: Number(requestedValue),
        error: `No balance found for token ${tokenName} (${tokenAddress}).`,
      };
    }

    // 3. Convert balance → human-readable
    const decimals = tokenData.decimals || 18;
    const rawBalance = BigInt(tokenData.balance);
    const balanceHuman = Number(rawBalance) / 10 ** decimals;

    const requested = Number(requestedValue);

    // 4. Compare
    if (balanceHuman < requested) {
      console.error("Insufficient balance for token", tokenName, tokenAddress);
      return {
        ok: false,
        balanceHuman,
        requested,
        error: `Insufficient balance: user has ${balanceHuman} ${tokenName}, but tried to supply ${requested}.`,
      };
    }

    // 5. Success
    return {
      ok: true,
      balanceHuman,
      requested,
    };
  } catch (err) {
    console.error("checkTokenBalance error:", err);
    return {
      ok: false,
      balanceHuman: 0,
      requested: Number(requestedValue),
      error: "Unexpected error while checking token balance",
    };
  }
}
