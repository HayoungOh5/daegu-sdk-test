import * as path from "path";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Mitum } from "daegu-sdk";
import { setNetwork, parseArgs } from "../../src/setting";
import { currentTime } from "../../src/common";
import { TestHelper } from "../../src/testUtils";
import { scPath } from "../../src/sdkHelper";

chai.use(chaiAsPromised);

const { network, timeout } = parseArgs();
const { network_type, api_url, test_account } = setNetwork(network);
const { address: sender, privatekey, currency } = test_account;

const summaryFile = path.join(
  __dirname,
  "..",
  "0_summary",
  `prescription_error_${network_type}_${currentTime()}.txt`,
);

describe("prescription / error", function () {
  this.timeout(timeout + 60000);
  const mitum = new Mitum(api_url);
  const th = new TestHelper(summaryFile);

  let contractAddress: string;
  const seedHash = `seed_${currentTime()}`;

  before(async () => {
    const wallet = mitum.contract.createWallet(sender, currency, 1);
    contractAddress = wallet.wallet.address;
    const touchRes: any = await mitum.contract.touch(privatekey, wallet);
    if (touchRes?.response?.status !== 200) {
      console.log("[debug] touch send status=", touchRes?.response?.status,
                  "data=", JSON.stringify(touchRes?.response?.error_message));
    }
    await touchRes.wait(timeout, 1000);
    const op = mitum.program.registerByCodeFile(
      contractAddress,
      sender,
      scPath("test_prescription", "sc_prescription.go"),
      currency,
    );
    op.sign(privatekey);
    const regRes: any = await mitum.operation.send(op);
    if (regRes?.response?.status !== 200) {
      console.log("[debug] send status=", regRes?.response?.status,
                  "data=", JSON.stringify(regRes?.response?.error_message));
    }
    await regRes.wait(timeout, 1000);

    // seed registered prescription
    const now = Math.floor(Date.now() / 1000);
    const seed = mitum.program.call(
      contractAddress,
      sender,
      currency,
      "RegisterPrescription",
      {
        prescriptionHash: seedHash,
        prescribeDate: now.toString(),
        endDate: (now + 600).toString(),
        hospital: "seed hospital",
      },
    );
    seed.sign(privatekey);
    const seedRes: any = await mitum.operation.send(seed);
    if (seedRes?.response?.status !== 200) {
      console.log("[debug] send status=", seedRes?.response?.status,
                  "data=", JSON.stringify(seedRes?.response?.error_message));
    }
    await seedRes.wait(timeout, 1000);
  });

  it("1. Revert: RegisterPrescription expired endDate", async function () {
    const past = Math.floor(Date.now() / 1000) - 3600;
    await th.assertErrorThrown(
      async () => {
        const op = mitum.program.call(
          contractAddress,
          sender,
          currency,
          "RegisterPrescription",
          {
            prescriptionHash: `expired_${currentTime()}`,
            prescribeDate: (past - 60).toString(),
            endDate: past.toString(),
            hospital: "expired hospital",
          },
        );
        op.sign(privatekey);
        const res: any = await mitum.operation.send(op);
        if (res?.response?.status !== 200) {
          console.log("[debug] send status=", res?.response?.status,
                      "data=", JSON.stringify(res?.response?.error_message));
        }
        return await res.wait(timeout, 1000);
      },
      undefined,
      "cannot register expired prescription",
    );
    th.record(this.test!.title, true);
  });

  it("2. Revert: RegisterPrescription duplicate hash", async function () {
    const now = Math.floor(Date.now() / 1000);
    await th.assertErrorThrown(
      async () => {
        const op = mitum.program.call(
          contractAddress,
          sender,
          currency,
          "RegisterPrescription",
          {
            prescriptionHash: seedHash,
            prescribeDate: now.toString(),
            endDate: (now + 600).toString(),
            hospital: "dup hospital",
          },
        );
        op.sign(privatekey);
        const res: any = await mitum.operation.send(op);
        if (res?.response?.status !== 200) {
          console.log("[debug] send status=", res?.response?.status,
                      "data=", JSON.stringify(res?.response?.error_message));
        }
        return await res.wait(timeout, 1000);
      },
      undefined,
      "cannot register same hash",
    );
    th.record(this.test!.title, true);
  });

  it("3. Revert: UsePrescription unknown hash", async function () {
    const now = Math.floor(Date.now() / 1000);
    await th.assertErrorThrown(
      async () => {
        const op = mitum.program.call(
          contractAddress,
          sender,
          currency,
          "UsePrescription",
          {
            prescriptionHash: "ghost_hash_does_not_exist",
            prepareDate: now.toString(),
            pharmacy: "ghost pharmacy",
          },
        );
        op.sign(privatekey);
        const res: any = await mitum.operation.send(op);
        if (res?.response?.status !== 200) {
          console.log("[debug] send status=", res?.response?.status,
                      "data=", JSON.stringify(res?.response?.error_message));
        }
        return await res.wait(timeout, 1000);
      },
      undefined,
      "prescription does not registered or already used",
    );
    th.record(this.test!.title, true);
  });

  after(() => th.summary());
});
