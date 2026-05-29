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
  `dmile_error_${network_type}_${currentTime()}.txt`,
);

describe("dmile / error", function () {
  this.timeout(timeout + 60000);
  const mitum = new Mitum(api_url);
  const th = new TestHelper(summaryFile);

  let contractAddress: string;

  before(async () => {
    const wallet = mitum.contract.createWallet(sender, currency, 1);
    contractAddress = wallet.wallet.address;
    await (await mitum.contract.touch(privatekey, wallet)).wait(timeout, 1000);
    const op = mitum.program.registerByCodeFile(
      contractAddress,
      sender,
      scPath("test_dmile", "sc_dmile.go"),
      currency,
    );
    op.sign(privatekey);
    await (await mitum.operation.send(op)).wait(timeout, 1000);
  });

  it("1. Revert: EarnMileage empty anchorID", async function () {
    await th.assertErrorThrown(
      async () => {
        const op = mitum.program.call(contractAddress, sender, currency, "EarnMileage", {
          anchorID: "",
          merkleRoot:
            "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        });
        op.sign(privatekey);
        return await (await mitum.operation.send(op)).wait(timeout, 1000);
      },
      undefined,
      "empty anchor id",
    );
    th.record(this.test!.title, true);
  });

  it("2. Revert: EarnMileage invalid merkle root length", async function () {
    await th.assertErrorThrown(
      async () => {
        const op = mitum.program.call(contractAddress, sender, currency, "EarnMileage", {
          anchorID: `bad_${currentTime()}`,
          merkleRoot: "tooshort",
        });
        op.sign(privatekey);
        return await (await mitum.operation.send(op)).wait(timeout, 1000);
      },
      undefined,
      "invalid merkle root length",
    );
    th.record(this.test!.title, true);
  });

  after(() => th.summary());
});
