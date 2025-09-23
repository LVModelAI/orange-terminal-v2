import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();
export const CHAIN_ID = 1116;
export const MAX_TRANSACTION_AMOUNT = 1000;

// walletconnect rpc base url
export const WALLETCONNECT_RPC_BASE_URL = "https://rpc.walletconnect.org/v1";

// corescan base url
export const CORESCAN_BASE_URL = "https://scan.coredao.org";
//core scan rpc url
export const CORESCAN_RPC_URL = "https://rpc.coredao.org";

// --- Token addresses ---
// --- Core Ecosystem Tokens ---
export const CORE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";
export const WCORE_TOKEN_ADDRESS = "0x191e94fa59739e188dce837f7f6978d84727ad01";

// --- Stablecoins ---
export const USDC_TOKEN_ADDRESS = "0xa4151b2b3e269645181dccf2d426ce75fcbdeca9";
export const USDT_TOKEN_ADDRESS = "0x900101d06a7426441ae63e9ab3b9b0f63be145f1";

// --- SolvBTC Variants ---
export const SOLVBTC_B_ADDRESS = "0x5b1fb849f1f76217246b8aaac053b5c7b15b7dc3"; // SolvBTC.b
export const SOLVBTC_M_ADDRESS = "0xe04d21d999faedf1e72ade6629e20a11a1ed14fa"; // SolvBTC.m
export const SOLVBTC_C_ADDRESS = "0x9410e8052bc661041e5cb27fdf7d9e9e842af2aa"; // SolvBTC.c

// --- Staked CORE ---
export const STCORE_TOKEN_ADDRESS =
  "0xb3a8f0f0da9ffc65318aa39e55079796093029ad";
export const DUALCORE_TOKEN_ADDRESS =
  "0xc5555eA27e63cd89f8b227deCe2a3916800c0f4F";

//---- Defi stats api urls ----
export const VALIDATORS_API =
  "https://staking-api.coredao.org/staking/status/validators";
export const COLEND_API = "https://yields.llama.fi/pools";
export const DESYN_API =
  "https://api.desyn.io/core/etf/stats?offset=0&num=10&period=DAY&sortby=BY_NET_VALUE&desc=true&etype=&invest_label=&risk_label=&pay_token=&strategy_type=&strategy_token_label=&etf_status=-1&pool_name=";
export const PELL_API =
  "https://api.pell.network/v1/stakeListByPage?page=1&pageSize=20&params=1116";

// --- Staking, undelegate and transfer core on coreDao ---
// get staking portfolio
export const CORE_STAKING_PORTFOLIO_API =
  "https://staking-api.coredao.org/staking/summary/core";
// get rewards details
export const CORE_STAKING_REWARDS_DETAIL_API =
  "https://staking-api.coredao.org/staking/rewards/detail";
// for getting delegated core for each validator
export const CORE_STAKING_DELEGATED_CORE_API =
  "https://stake.coredao.org/api/staking/search_delegator";

// for staking, undelegate and transfer core
export const TESTNET_COREAGENT_CONTRACT_ADDRESS =
  "0x0000000000000000000000000000000000001011";
export const MAINNET_COREAGENT_CONTRACT_ADDRESS =
  "0x0000000000000000000000000000000000001011";

//for claiming rewards
export const TESTNET_PLEDGEAGENT_CONTRACT_ADDRESS =
  "0x0000000000000000000000000000000000001007";
export const MAINNET_PLEDGEAGENT_CONTRACT_ADDRESS =
  "0x0000000000000000000000000000000000001007";

// CoreAgent contract address on each chain
export const chainIdToCoreAgent: Record<number, string> = {
  1114: TESTNET_COREAGENT_CONTRACT_ADDRESS,
  1116: MAINNET_COREAGENT_CONTRACT_ADDRESS,
};
// Replace with your actual PledgeAgent addresses
export const chainIdToPledgeAgent: Record<number, string> = {
  1114: TESTNET_PLEDGEAGENT_CONTRACT_ADDRESS,
  1116: MAINNET_PLEDGEAGENT_CONTRACT_ADDRESS,
};

// --- Colend ---
export const COLEND_POOL_PROXY_ADDRESS =
  "0x0CEa9F0F49F30d376390e480ba32f903B43B19C5";
export const COLEND_POOL_ADDRESS = "0x971A4AD43a98a0d17833aB8c9FeC25b93a38B9A3";
export const COLEND_WrappedTokenGatewayV3 =
  "0x95D6da01eBdb6b2cD8150dFd6368cab0D4e74788";

// --- Molten (swap) ---
export const MOLTEN_SWAP_ROUTER = "0x832933BA44658C50ae6152039Cd30A6f4C2432b1";
export const MOLTEN_QUOTER = "0x20dA24b5FaC067930Ced329A3457298172510Fe7";
export const ALGEBRA_FACTORY =
  "0x74EfE55beA4988e7D92D03EFd8ddB8BF8b7bD597" as `0x${string}`;
export const SLIPPAGE_FOR_SWAPS = "0.5";

// --- Pell ---
// for staking erc20
export const PELL_ADMIN_UPGRADEABLILITY_PROXY_CONTRACT_ADDRESS =
  "0x00b67e4805138325ce871d5e27dc15f994681bc1";

//for fetching pell portfolio of the user's wallet
export const PELL_PORTFOLIO_BASE_API =
  "https://api.pell.network/v1/userStakeList";

// for unstaking and withdrawing erc20
export const PELL_WITHDRAWALS_CONTRACT =
  "0x230B442c0802fE83DAf3d2656aaDFD16ca1E1F66";

// for fetching the queued withdrawals
export const PELL_WITHDRAWALS_BASE_API =
  "https://api.pell.network/v1/withdrawalQueuedList";

// --- B14G ---
export const DUALCORE_VAULT_CONTRACT =
  "0xee21ab613d30330823D35Cf91A84cE964808B83F";
