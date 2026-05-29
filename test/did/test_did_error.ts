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
  `did_error_${network_type}_${currentTime()}.txt`,
);

describe("did / error", function () {
  this.timeout(timeout + 60000);
  const mitum = new Mitum(api_url);
  const th = new TestHelper(summaryFile);

  let contractAddress: string;
  const pubKey =
    "02f11a0c921b00672c5b4e798d7c63f8044cd5e1f021093fd03ad66ae9222e7207fpu";

  before(async () => {
    const wallet = mitum.contract.createWallet(sender, currency, 1);
    contractAddress = wallet.wallet.address;
    await (await mitum.contract.touch(privatekey, wallet)).wait(timeout, 1000);
    const op = mitum.program.registerByCodeFile(
      contractAddress,
      sender,
      scPath("test_did", "sc_did.go"),
      currency,
    );
    op.sign(privatekey);
    await (await mitum.operation.send(op)).wait(timeout, 1000);
    // seed one DID for reuse tests
    const seed = mitum.program.call(contractAddress, sender, currency, "CreateDID", {
      pubKey,
    });
    seed.sign(privatekey);
    await (await mitum.operation.send(seed)).wait(timeout, 1000);
  });

  it("1. Revert: CreateDID with bad pubkey suffix", async function () {
    await th.assertErrorThrown(
      async () => {
        const op = mitum.program.call(contractAddress, sender, currency, "CreateDID", {
          pubKey: "0123abcXYZ",
        });
        op.sign(privatekey);
        return await (await mitum.operation.send(op)).wait(timeout, 1000);
      },
      undefined,
      "invalid pubkey suffix",
    );
    th.record(this.test!.title, true);
  });

  it("2. Revert: CreateDID duplicate", async function () {
    await th.assertErrorThrown(
      async () => {
        const op = mitum.program.call(contractAddress, sender, currency, "CreateDID", {
          pubKey,
        });
        op.sign(privatekey);
        return await (await mitum.operation.send(op)).wait(timeout, 1000);
      },
      undefined,
      "did already created",
    );
    th.record(this.test!.title, true);
  });

  it("3. Revert: DeactivateDID unknown did", async function () {
    await th.assertErrorThrown(
      async () => {
        const op = mitum.program.call(contractAddress, sender, currency, "DeactivateDID", {
          did: "did:fpu:nonexistentfpu",
        });
        op.sign(privatekey);
        return await (await mitum.operation.send(op)).wait(timeout, 1000);
      },
      undefined,
      "did document not found",
    );
    th.record(this.test!.title, true);
  });

  after(() => th.summary());
});
