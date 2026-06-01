import * as path from "path";
import { Mitum } from "daegu-sdk";
import { setNetwork, parseArgs } from "../../src/setting";
import { currentTime } from "../../src/common";
import { TestHelper } from "../../src/testUtils";
import { measure } from "../../src/metrics";
import { makeCtx, scPath } from "../../src/sdkHelper";

const { network, timeout } = parseArgs();
const { network_type, api_url, test_account } = setNetwork(network);
const { address: sender, privatekey, currency } = test_account;

const summaryFile = path.join(
  __dirname,
  "..",
  "0_summary",
  `did_model_${network_type}_${currentTime()}.txt`,
);

describe("did / model", function () {
  this.timeout(timeout + 60000);
  const mitum = new Mitum(api_url);
  const th = new TestHelper(summaryFile);
  const ctx = makeCtx(mitum, network_type, "did_model");

  let contractAddress: string;
  const pubKey =
    "03f11a0c921b00672c5b4e798d7c63f8044cd5e1f021093fd03ad66ae9222e7207fpu";
  const did = `did:fpu:${pubKey}`;

  before(async () => {
    const wallet = mitum.contract.createWallet(sender, currency, 1);
    contractAddress = wallet.wallet.address;
    await measure({ ...ctx, test: "before:createCA" }, "contract.touch", async () => {
      const res: any = await mitum.contract.touch(privatekey, wallet);
      if (res?.response?.status !== 200) {
        console.log("[debug] touch send status=", res?.response?.status,
                    "data=", JSON.stringify(res?.response?.error_message));
      }
      return await res.wait(timeout, 1000);
    });
    await measure({ ...ctx, test: "before:register" }, "program.registerByCodeFile", async () => {
      const op = mitum.program.registerByCodeFile(
        contractAddress,
        sender,
        scPath("test_did", "sc_did.go"),
        currency,
      );
      op.sign(privatekey);
      const res: any = await mitum.operation.send(op);
      if (res?.response?.status !== 200) {
        console.log("[debug] send status=", res?.response?.status,
                    "data=", JSON.stringify(res?.response?.error_message));
      }
      return await res.wait(timeout, 1000);
    });
    th.log(`contract=${contractAddress}`);
  });

  it("1. CreateDID", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:CreateDID", async () => {
      const op = mitum.program.call(contractAddress, sender, currency, "CreateDID", {
        pubKey,
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

  it("2. DeactivateDID", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:DeactivateDID", async () => {
      const op = mitum.program.call(contractAddress, sender, currency, "DeactivateDID", {
        did,
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

  it("3. ReactivateDID", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:ReactivateDID", async () => {
      const op = mitum.program.call(contractAddress, sender, currency, "ReactivateDID", {
        did,
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

  it("4. query GetDIDDocument", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:GetDIDDocument", async () => {
      return await mitum.program.query(contractAddress, "GetDIDDocument", { did });
    });
    th.record(this.test!.title, true);
  });

  after(() => th.summary());
});
