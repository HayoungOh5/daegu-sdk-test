import * as path from "path";
import { expect } from "chai";
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
  `nft_model_${network_type}_${currentTime()}.txt`,
);

describe("nft / model", function () {
  this.timeout(timeout + 60000);
  const mitum = new Mitum(api_url);
  const th = new TestHelper(summaryFile);
  const ctx = makeCtx(mitum, network_type, "nft_model");

  let contractAddress: string;
  let user2: { address: string; privatekey: string };
  const base = Date.now();
  const tokenA = String(base);       // owner-burn flow
  const tokenB = String(base + 1);   // single-token approval -> transferFrom
  const tokenC = String(base + 2);   // operator (setApprovalForAll) transferFrom
  const tokenD = String(base + 3);   // stays with sender at end of suite
  const uri = (n: string) => `ipfs://example/${n}.json`;

  const call = (
    func: string,
    args: Record<string, string>,
    signer: string = privatekey,
    from: string = sender,
  ) => {
    const op = mitum.program.call(contractAddress, from, currency, func, args);
    op.sign(signer);
    return op;
  };

  const send = async (op: ReturnType<typeof call>) => {
    const res = await mitum.operation.send(op);
    return await res.wait(timeout, 1000);
  };

  before(async () => {
    await measure({ ...ctx, test: "before:createUser2" }, "account.createWallet", async () => {
      const acc = mitum.account.createWallet(sender, currency, 1000);
      user2 = { address: acc.wallet.address, privatekey: acc.wallet.privatekey };
      acc.operation.sign(privatekey);
      const res = await mitum.operation.send(acc.operation);
      return await res.wait(timeout, 1000);
    });

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
        scPath("test_nft", "sc_nft.go"),
        currency,
        { name: "DaeguNFT", symbol: "DNFT" },
      );
      op.sign(privatekey);
      const res = await mitum.operation.send(op);
      return await res.wait(timeout, 1000);
    });
  });

  it("1. Mint tokenA to sender", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:Mint", async () =>
      send(call("Mint", { to: sender, tokenID: tokenA, tokenURI: uri("A") })),
    );
    th.record(this.test!.title, true);
  });

  it("2. Mint tokenB,C,D to sender (batch setup)", async function () {
    ctx.test = this.test!.title;
    for (const [tid, label] of [[tokenB, "B"], [tokenC, "C"], [tokenD, "D"]] as const) {
      await measure(ctx, `program.call:Mint:${label}`, async () =>
        send(call("Mint", { to: sender, tokenID: tid, tokenURI: uri(label) })),
      );
    }
    th.record(this.test!.title, true);
  });

  it("3. query Name", async function () {
    ctx.test = this.test!.title;
    const res: any = await measure(ctx, "program.query:Name", async () =>
      mitum.program.query(contractAddress, "Name", {}),
    );
    th.record(this.test!.title, true, JSON.stringify(res?.data ?? res));
  });

  it("4. query Symbol", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:Symbol", async () =>
      mitum.program.query(contractAddress, "Symbol", {}),
    );
    th.record(this.test!.title, true);
  });

  it("5. query TotalSupply == 4", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:TotalSupply", async () =>
      mitum.program.query(contractAddress, "TotalSupply", {}),
    );
    th.record(this.test!.title, true);
  });

  it("6. query OwnerOf(tokenA) == sender", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:OwnerOf", async () =>
      mitum.program.query(contractAddress, "OwnerOf", { tokenID: tokenA }),
    );
    th.record(this.test!.title, true);
  });

  it("7. query BalanceOf(sender) == 4", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:BalanceOf", async () =>
      mitum.program.query(contractAddress, "BalanceOf", { owner: sender }),
    );
    th.record(this.test!.title, true);
  });

  it("8. query TokenURI(tokenA)", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:TokenURI", async () =>
      mitum.program.query(contractAddress, "TokenURI", { tokenID: tokenA }),
    );
    th.record(this.test!.title, true);
  });

  it("9. query Exists(tokenA) == true", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:Exists", async () =>
      mitum.program.query(contractAddress, "Exists", { tokenID: tokenA }),
    );
    th.record(this.test!.title, true);
  });

  it("10. query TokensOfOwner(sender)", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:TokensOfOwner", async () =>
      mitum.program.query(contractAddress, "TokensOfOwner", { owner: sender }),
    );
    th.record(this.test!.title, true);
  });

  it("11. Approve user2 for tokenB", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:Approve", async () =>
      send(call("Approve", { to: user2.address, tokenID: tokenB })),
    );
    th.record(this.test!.title, true);
  });

  it("12. query GetApproved(tokenB) == user2", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:GetApproved", async () =>
      mitum.program.query(contractAddress, "GetApproved", { tokenID: tokenB }),
    );
    th.record(this.test!.title, true);
  });

  it("13. TransferFrom tokenB sender -> user2 (signed by user2 via single-token approval)", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:TransferFrom:approved", async () =>
      send(
        call(
          "TransferFrom",
          { from: sender, to: user2.address, tokenID: tokenB },
          user2.privatekey,
          user2.address,
        ),
      ),
    );
    th.record(this.test!.title, true);
  });

  it("14. query OwnerOf(tokenB) == user2 (post-transfer)", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:OwnerOf:postTransfer", async () =>
      mitum.program.query(contractAddress, "OwnerOf", { tokenID: tokenB }),
    );
    th.record(this.test!.title, true);
  });

  it("15. SetApprovalForAll(user2, true)", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:SetApprovalForAll", async () =>
      send(call("SetApprovalForAll", { operator: user2.address, approved: "true" })),
    );
    th.record(this.test!.title, true);
  });

  it("16. query IsApprovedForAll(sender, user2) == true", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:IsApprovedForAll", async () =>
      mitum.program.query(contractAddress, "IsApprovedForAll", {
        owner: sender,
        operator: user2.address,
      }),
    );
    th.record(this.test!.title, true);
  });

  it("17. TransferFrom tokenC sender -> user2 (signed by user2 as operator)", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:TransferFrom:operator", async () =>
      send(
        call(
          "TransferFrom",
          { from: sender, to: user2.address, tokenID: tokenC },
          user2.privatekey,
          user2.address,
        ),
      ),
    );
    th.record(this.test!.title, true);
  });

  it("18. SetApprovalForAll(user2, false) revoke", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:SetApprovalForAll:revoke", async () =>
      send(call("SetApprovalForAll", { operator: user2.address, approved: "false" })),
    );
    th.record(this.test!.title, true);
  });

  it("19. query IsApprovedForAll(sender, user2) == false (post-revoke)", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:IsApprovedForAll:postRevoke", async () =>
      mitum.program.query(contractAddress, "IsApprovedForAll", {
        owner: sender,
        operator: user2.address,
      }),
    );
    th.record(this.test!.title, true);
  });

  it("20. Burn tokenA (owner burns)", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.call:Burn", async () =>
      send(call("Burn", { tokenID: tokenA })),
    );
    th.record(this.test!.title, true);
  });

  it("21. query Exists(tokenA) == false (post-burn)", async function () {
    ctx.test = this.test!.title;
    const res: any = await measure(ctx, "program.query:Exists:postBurn", async () =>
      mitum.program.query(contractAddress, "Exists", { tokenID: tokenA }),
    );
    th.record(this.test!.title, true, JSON.stringify(res?.data ?? res));
  });

  it("22. query TotalSupply == 3 (post-burn)", async function () {
    ctx.test = this.test!.title;
    await measure(ctx, "program.query:TotalSupply:postBurn", async () =>
      mitum.program.query(contractAddress, "TotalSupply", {}),
    );
    th.record(this.test!.title, true);
  });

  it("23. query TokensOfOwner(user2) contains tokenB and tokenC", async function () {
    ctx.test = this.test!.title;
    const res: any = await measure(ctx, "program.query:TokensOfOwner:user2", async () =>
      mitum.program.query(contractAddress, "TokensOfOwner", { owner: user2.address }),
    );
    expect(res, "query returned nothing").to.not.be.undefined;
    th.record(this.test!.title, true, JSON.stringify(res?.data ?? res));
  });

  after(() => th.summary());
});
