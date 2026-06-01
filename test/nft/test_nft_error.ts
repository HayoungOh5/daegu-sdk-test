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
  `nft_error_${network_type}_${currentTime()}.txt`,
);

describe("nft / error", function () {
  this.timeout(timeout + 60000);
  const mitum = new Mitum(api_url);
  const th = new TestHelper(summaryFile);

  let contractAddress: string;
  let user2: { address: string; privatekey: string };
  const base = Date.now();
  const seedToken = String(base);     // minted in before(); owned by sender
  const lonelyToken = String(base + 1); // minted in before(); used by burn-by-stranger test

  const buildCall = (
    func: string,
    args: Record<string, string>,
    signer: string = privatekey,
    from: string = sender,
  ) => {
    const op = mitum.program.call(contractAddress, from, currency, func, args);
    op.sign(signer);
    return op;
  };

  const fire = async (op: ReturnType<typeof buildCall>) => {
    const res: any = await mitum.operation.send(op);
    if (res?.response?.status !== 200) {
      console.log("[debug] send status=", res?.response?.status,
                  "data=", JSON.stringify(res?.response?.error_message));
    }
    return await res.wait(timeout, 1000);
  };

  before(async () => {
    const acc = mitum.account.createWallet(sender, currency, 1000);
    user2 = { address: acc.wallet.address, privatekey: acc.wallet.privatekey };
    acc.operation.sign(privatekey);
    const accRes: any = await mitum.operation.send(acc.operation);
    if (accRes?.response?.status !== 200) {
      console.log("[debug] send status=", accRes?.response?.status,
                  "data=", JSON.stringify(accRes?.response?.error_message));
    }
    await accRes.wait(timeout, 1000);

    const wallet = mitum.contract.createWallet(sender, currency, 1);
    contractAddress = wallet.wallet.address;
    const touchRes: any = await mitum.contract.touch(privatekey, wallet);
    if (touchRes?.response?.status !== 200) {
      console.log("[debug] touch send status=", touchRes?.response?.status,
                  "data=", JSON.stringify(touchRes?.response?.error_message));
    }
    await touchRes.wait(timeout, 1000);
    const reg = mitum.program.registerByCodeFile(
      contractAddress,
      sender,
      scPath("test_nft", "sc_nft.go"),
      currency,
      { name: "ErrNFT", symbol: "ENFT" },
    );
    reg.sign(privatekey);
    const regRes: any = await mitum.operation.send(reg);
    if (regRes?.response?.status !== 200) {
      console.log("[debug] send status=", regRes?.response?.status,
                  "data=", JSON.stringify(regRes?.response?.error_message));
    }
    await regRes.wait(timeout, 1000);

    await fire(buildCall("Mint", { to: sender, tokenID: seedToken, tokenURI: "ipfs://seed" }));
    await fire(buildCall("Mint", { to: sender, tokenID: lonelyToken, tokenURI: "ipfs://lonely" }));
  });

  it("1. Revert: Mint duplicate tokenID", async function () {
    await th.assertErrorThrown(
      () => fire(buildCall("Mint", { to: sender, tokenID: seedToken, tokenURI: "ipfs://dup" })),
      undefined,
      "token already exists",
    );
    th.record(this.test!.title, true);
  });

  it("2. Revert: Mint by non-owner caller", async function () {
    await th.assertErrorThrown(
      () =>
        fire(
          buildCall(
            "Mint",
            { to: user2.address, tokenID: String(base + 100), tokenURI: "ipfs://nope" },
            user2.privatekey,
            user2.address,
          ),
        ),
      undefined,
      "only owner can mint",
    );
    th.record(this.test!.title, true);
  });

  it("3. Revert: Mint to empty recipient", async function () {
    await th.assertErrorThrown(
      () => fire(buildCall("Mint", { to: "", tokenID: String(base + 101), tokenURI: "ipfs://x" })),
      undefined,
      "invalid recipient",
    );
    th.record(this.test!.title, true);
  });

  it("4. Revert: Burn non-existent token", async function () {
    await th.assertErrorThrown(
      () => fire(buildCall("Burn", { tokenID: "99999999999999" })),
      undefined,
      "token does not exist",
    );
    th.record(this.test!.title, true);
  });

  it("5. Revert: Burn by non-owner / non-approved caller", async function () {
    await th.assertErrorThrown(
      () =>
        fire(
          buildCall(
            "Burn",
            { tokenID: lonelyToken },
            user2.privatekey,
            user2.address,
          ),
        ),
      undefined,
      "not approved",
    );
    th.record(this.test!.title, true);
  });

  it("6. Revert: TransferFrom non-existent token", async function () {
    await th.assertErrorThrown(
      () =>
        fire(
          buildCall("TransferFrom", {
            from: sender,
            to: sender,
            tokenID: "88888888888888",
          }),
        ),
      undefined,
      "token does not exist",
    );
    th.record(this.test!.title, true);
  });

  it("7. Revert: TransferFrom by caller without approval (user2 tries to take sender's token)", async function () {
    await th.assertErrorThrown(
      () =>
        fire(
          buildCall(
            "TransferFrom",
            { from: sender, to: user2.address, tokenID: seedToken },
            user2.privatekey,
            user2.address,
          ),
        ),
      undefined,
      "not approved",
    );
    th.record(this.test!.title, true);
  });

  it("8. Revert: TransferFrom with wrong `from` (owner is sender, claim user2 owns it)", async function () {
    await th.assertErrorThrown(
      () =>
        fire(
          buildCall("TransferFrom", {
            from: user2.address,
            to: user2.address,
            tokenID: seedToken,
          }),
        ),
      undefined,
      "from is not owner",
    );
    th.record(this.test!.title, true);
  });

  it("9. Revert: TransferFrom to empty recipient", async function () {
    await th.assertErrorThrown(
      () =>
        fire(
          buildCall("TransferFrom", { from: sender, to: "", tokenID: seedToken }),
        ),
      undefined,
      "invalid recipient",
    );
    th.record(this.test!.title, true);
  });

  it("10. Revert: Approve called by stranger (user2 on sender's token)", async function () {
    await th.assertErrorThrown(
      () =>
        fire(
          buildCall(
            "Approve",
            { to: user2.address, tokenID: seedToken },
            user2.privatekey,
            user2.address,
          ),
        ),
      undefined,
      "not owner nor operator",
    );
    th.record(this.test!.title, true);
  });

  it("11. Revert: Approve on non-existent token", async function () {
    await th.assertErrorThrown(
      () => fire(buildCall("Approve", { to: user2.address, tokenID: "77777777777777" })),
      undefined,
      "token does not exist",
    );
    th.record(this.test!.title, true);
  });

  it("12. Revert: SetApprovalForAll on self", async function () {
    await th.assertErrorThrown(
      () => fire(buildCall("SetApprovalForAll", { operator: sender, approved: "true" })),
      undefined,
      "cannot approve self",
    );
    th.record(this.test!.title, true);
  });

  after(() => th.summary());
});
