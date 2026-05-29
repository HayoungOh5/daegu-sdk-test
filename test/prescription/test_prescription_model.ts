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
  `prescription_model_${network_type}_${currentTime()}.txt`,
);

describe("prescription / model", function () {
  this.timeout(timeout + 60000);
  const mitum = new Mitum(api_url);
  const th = new TestHelper(summaryFile);
  const ctx = makeCtx(mitum, network_type, "prescription_model");

  let contractAddress: string;
  const prescriptionHash = `presc_${currentTime()}`;

  before(async () => {
    const wallet = mitum.contract.createWallet(sender, currency, 1);
    contractAddress = wallet.wallet.address;
    await measure({ ...ctx, test: "before:createCA" }, "contract.touch", async () => {
      const res = await mitum.contract.touch(privatekey, wallet);
      return await res.wait(timeout, 1000);
    });
    await measure({ ...ctx, test: "before:register" }, "program.registerByCodeFile", async () => {
      const op = mitum.program.registerByCodeFile(
        contractAddress,
        sender,
        scPath("test_prescription", "sc_prescription.go"),
        currency,
      );
      op.sign(privatekey);
      const res = await mitum.operation.send(op);
      return await res.wait(timeout, 1000);
    });
  });

  it("1. RegisterPrescription", async function () {
    ctx.test = this.test!.title;
    const now = Math.floor(Date.now() / 1000);
    const endDate = now + 600;
    await measure(ctx, "program.call:RegisterPrescription", async () => {
      const op = mitum.program.call(
        contractAddress,
        sender,
        currency,
        "RegisterPrescription",
        {
          prescriptionHash,
          prescribeDate: now.toString(),
          endDate: endDate.toString(),
          hospital: "choi hospital",
        },
      );
      op.sign(privatekey);
      const res = await mitum.operation.send(op);
      return await res.wait(timeout, 1000);
    });
    th.record(this.test!.title, true);
  });

  it("2. UsePrescription", async function () {
    ctx.test = this.test!.title;
    const now = Math.floor(Date.now() / 1000);
    await measure(ctx, "program.call:UsePrescription", async () => {
      const op = mitum.program.call(
        contractAddress,
        sender,
        currency,
        "UsePrescription",
        {
          prescriptionHash,
          prepareDate: now.toString(),
          pharmacy: "park pharmacy",
        },
      );
      op.sign(privatekey);
      const res = await mitum.operation.send(op);
      return await res.wait(timeout, 1000);
    });
    th.record(this.test!.title, true);
  });

  it("3. query GetPrescriptionInfo", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:GetPrescriptionInfo", async () => {
      return await mitum.program.query(contractAddress, "GetPrescriptionInfo", {
        prescriptionHash,
      });
    });
    th.record(this.test!.title, true);
  });

  after(() => th.summary());
});
