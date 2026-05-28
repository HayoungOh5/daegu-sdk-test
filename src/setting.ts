export type NetworkType = "local" | "dev" | "testnet";

export interface TestAccount {
  address: string;
  privatekey: string;
  currency: string;
}

export interface NetworkConfig {
  network_type: NetworkType;
  api_url: string;
  delegate_url?: string;
  test_account: TestAccount;
}

const NETWORKS: Record<NetworkType, NetworkConfig> = {
  local: {
    network_type: "local",
    api_url: "http://127.0.0.1:54320",
    test_account: {
      address: "0x4526f3D0EdC63D9EaeCD94D56551e0f061CFCa47fca",
      privatekey: "41f08256757d96a522e6d36a097bd2f761109059b72eb6589ff827f7ac877d30fpr",
      currency: "MCC",
    },
  },
  dev: {
    network_type: "dev",
    api_url: process.env.DAEGU_DEV_API ?? "http://127.0.0.1:54320",
    test_account: {
      address: process.env.DAEGU_DEV_ADDR ?? "",
      privatekey: process.env.DAEGU_DEV_PRIV ?? "",
      currency: process.env.DAEGU_DEV_CURRENCY ?? "MCC",
    },
  },
  testnet: {
    network_type: "testnet",
    api_url: process.env.DAEGU_TESTNET_API ?? "",
    test_account: {
      address: process.env.DAEGU_TESTNET_ADDR ?? "",
      privatekey: process.env.DAEGU_TESTNET_PRIV ?? "",
      currency: process.env.DAEGU_TESTNET_CURRENCY ?? "MCC",
    },
  },
};

export function setNetwork(name: string = "local"): NetworkConfig {
  const cfg = NETWORKS[name as NetworkType];
  if (!cfg) throw new Error(`unknown network: ${name}`);
  return cfg;
}

export function parseArgs(): { network: string; timeout: number } {
  const arg = process.argv[process.argv.length - 1];
  if (!arg || arg.endsWith(".ts") || arg.endsWith(".js")) {
    return { network: "local", timeout: 30000 };
  }
  const [network, timeoutStr] = arg.split(",");
  return { network, timeout: Number(timeoutStr) || 30000 };
}
