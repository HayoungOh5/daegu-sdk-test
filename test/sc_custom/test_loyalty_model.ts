import * as path from "path";
import { Mitum } from "daegu-sdk";
import { setNetwork, parseArgs } from "../../src/setting";
import { currentTime, sleep } from "../../src/common";
import { TestHelper } from "../../src/testUtils";
import { measure, MetricContext } from "../../src/metrics";
import { LOYALTY_CODE } from "./loyalty_code";

const { network, timeout } = parseArgs();
const { network_type, api_url, test_account } = setNetwork(network);
const { address: sender, privatekey, currency } = test_account;

const summaryFile = path.join(
  __dirname,
  "..",
  "0_summary",
  `loyalty_model_${network_type}_${currentTime()}.txt`,
);

describe("sc_custom / loyalty / model", function () {
  this.timeout(timeout + 60000);
  const mitum = new Mitum(api_url);
  const th = new TestHelper(summaryFile);
  const ctx: MetricContext = {
    network: network_type,
    suite: "loyalty_model",
    test: "",
    blockHeight: async () => {
      const info: any = await mitum.block.getAllBlocks(1, undefined, true);
      const h = info?.data?.[0]?._embedded?.Manifest?.height;
      if (h === undefined) {
        process.stderr.write(
          `[metrics] unexpected block response shape: ${JSON.stringify(info).slice(0, 300)}\n`,
        );
      }
      return h !== undefined ? Number(h) : undefined;
    },
  };

  let contractAddress: string;
  const storeName = `Cafe_${currentTime()}`;

  before(async () => {
    const wallet = mitum.contract.createWallet(sender, currency, 1);
    contractAddress = wallet.wallet.address ?? "";
    await measure({ ...ctx, test: "before:createCA" }, "contract.touch", async () => {
      const res: any = await mitum.contract.touch(privatekey, wallet);
      if (res?.response?.status !== 200) {
        console.log("[debug] touch send status=", res?.response?.status,
                    "data=", JSON.stringify(res?.response?.error_message));
      }
      return await res.wait(timeout, 1000);
    });
    th.log(`contract=${contractAddress} store=${storeName}`);
  });

  it("1. register loyalty program", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.register", async () => {
      const op = mitum.program.register(contractAddress, sender, LOYALTY_CODE, currency, {
        storeName,
      });
      op.sign(privatekey);
      const res: any = await mitum.operation.send(op);
      if (res?.response?.status !== 200) {
        console.log("[debug] send status=", res?.response?.status,
                    "data=", JSON.stringify(res?.response?.error_message));
      }
      return await res.wait(timeout, 1000);
    });
    th.record(this.test!.title, true);
  });

  it("2. join membership", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:JoinMembership", async () => {
      const op = mitum.program.call(contractAddress, sender, currency, "JoinMembership", {
        storeName,
        user: sender,
      });
      op.sign(privatekey);
      const res: any = await mitum.operation.send(op);
      if (res?.response?.status !== 200) {
        console.log("[debug] send status=", res?.response?.status,
                    "data=", JSON.stringify(res?.response?.error_message));
      }
      return await res.wait(timeout, 1000);
    });
    th.record(this.test!.title, true);
  });

  it("3. accumulate points", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:AccumulatePoints", async () => {
      const op = mitum.program.call(contractAddress, sender, currency, "AccumulatePoints", {
        storeName,
        user: sender,
        payment: "1000",
        rate: "5",
      });
      op.sign(privatekey);
      const res: any = await mitum.operation.send(op);
      if (res?.response?.status !== 200) {
        console.log("[debug] send status=", res?.response?.status,
                    "data=", JSON.stringify(res?.response?.error_message));
      }
      return await res.wait(timeout, 1000);
    });
    th.record(this.test!.title, true);
  });

  after(() => th.summary());
});
