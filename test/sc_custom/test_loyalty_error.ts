import * as path from "path";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Mitum } from "daegu-sdk";
import { setNetwork, parseArgs } from "../../src/setting";
import { currentTime } from "../../src/common";
import { TestHelper } from "../../src/testUtils";
import { LOYALTY_CODE } from "./loyalty_code";

chai.use(chaiAsPromised);

const { network, timeout } = parseArgs();
const { network_type, api_url, test_account } = setNetwork(network);
const { address: sender, privatekey, currency } = test_account;

const summaryFile = path.join(
  __dirname,
  "..",
  "0_summary",
  `loyalty_error_${network_type}_${currentTime()}.txt`,
);

describe("sc_custom / loyalty / error", function () {
  this.timeout(timeout + 60000);
  const mitum = new Mitum(api_url);
  const th = new TestHelper(summaryFile);

  let contractAddress: string;
  const storeName = `CafeErr_${currentTime()}`;

  before(async () => {
    const wallet = mitum.contract.createWallet(sender, currency, 1);
    contractAddress = wallet.wallet.address;
    const res: any = await mitum.contract.touch(privatekey, wallet);
    if (res?.response?.status !== 200) {
      console.log("[debug] touch send status=", res?.response?.status,
                  "data=", JSON.stringify(res?.response?.error_message));
    }
    await res.wait(timeout, 1000);

    const op = mitum.program.register(contractAddress, sender, LOYALTY_CODE, currency, {
      storeName,
    });
    op.sign(privatekey);
    const reg: any = await mitum.operation.send(op);
    if (reg?.response?.status !== 200) {
      console.log("[debug] send status=", reg?.response?.status,
                  "data=", JSON.stringify(reg?.response?.error_message));
    }
    await reg.wait(timeout, 1000);
  });

  it("1. Revert: JoinMembership on unknown store", async function () {
    await th.assertErrorThrown(
      async () => {
        const op = mitum.program.call(contractAddress, sender, currency, "JoinMembership", {
          storeName: "NoSuchStore",
          user: sender,
        });
        op.sign(privatekey);
        const res: any = await mitum.operation.send(op);
        if (res?.response?.status !== 200) {
          console.log("[debug] send status=", res?.response?.status,
                      "data=", JSON.stringify(res?.response?.error_message));
        }
        return await res.wait(timeout, 1000);
      },
      undefined,
      "store not found",
    );
    th.record(this.test!.title, true);
  });

  it("2. Revert: AccumulatePoints by non-owner", async function () {
    // 임시 EOA 생성 후 그 키로 호출 → permission denied 기대
    const w = mitum.account.createWallet(sender, currency, 100);
    const accTouchRes: any = await mitum.account.touch(privatekey, w);
    if (accTouchRes?.response?.status !== 200) {
      console.log("[debug] touch send status=", accTouchRes?.response?.status,
                  "data=", JSON.stringify(accTouchRes?.response?.error_message));
    }
    await accTouchRes.wait(timeout, 1000);
    const otherPriv = (w as any).privatekey ?? privatekey;
    const otherAddr = (w.wallet as any).address ?? sender;

    await th.assertErrorThrown(
      async () => {
        const op = mitum.program.call(contractAddress, otherAddr, currency, "AccumulatePoints", {
          storeName,
          user: otherAddr,
          payment: "100",
          rate: "1",
        });
        op.sign(otherPriv);
        const res: any = await mitum.operation.send(op);
        if (res?.response?.status !== 200) {
          console.log("[debug] send status=", res?.response?.status,
                      "data=", JSON.stringify(res?.response?.error_message));
        }
        return await res.wait(timeout, 1000);
      },
      undefined,
      "permission denied",
    );
    th.record(this.test!.title, true);
  });

  after(() => th.summary());
});
