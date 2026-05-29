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
  `dmile_model_${network_type}_${currentTime()}.txt`,
);

// 64-char hex (mock merkle root) — contract enforces len == 64
const merkleRoot =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const anchorID = `anchor_${currentTime()}`;

describe("dmile / model", function () {
  this.timeout(timeout + 60000);
  const mitum = new Mitum(api_url);
  const th = new TestHelper(summaryFile);
  const ctx = makeCtx(mitum, network_type, "dmile_model");

  let contractAddress: string;

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
        scPath("test_dmile", "sc_dmile.go"),
        currency,
      );
      op.sign(privatekey);
      const res = await mitum.operation.send(op);
      return await res.wait(timeout, 1000);
    });
  });

  it("1. EarnMileage", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:EarnMileage", async () => {
      const op = mitum.program.call(contractAddress, sender, currency, "EarnMileage", {
        anchorID,
        merkleRoot,
      });
      op.sign(privatekey);
      const res = await mitum.operation.send(op);
      return await res.wait(timeout, 1000);
    });
    th.record(this.test!.title, true);
  });

  it("2. query GetEarnServiceMerkleRootByAnchorID", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:GetEarnServiceMerkleRootByAnchorID", async () => {
      return await mitum.program.query(
        contractAddress,
        "GetEarnServiceMerkleRootByAnchorID",
        { anchorID },
      );
    });
    th.record(this.test!.title, true);
  });

  it("3. query GetAnchorIDByEarnServiceMerkleRoot", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:GetAnchorIDByEarnServiceMerkleRoot", async () => {
      return await mitum.program.query(
        contractAddress,
        "GetAnchorIDByEarnServiceMerkleRoot",
        { merkleRoot },
      );
    });
    th.record(this.test!.title, true);
  });

  it("4. query GetMerkleRootExistence", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:GetMerkleRootExistence", async () => {
      return await mitum.program.query(contractAddress, "GetMerkleRootExistence", {
        merkleRoot,
      });
    });
    th.record(this.test!.title, true);
  });

  after(() => th.summary());
});
