import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";

export class TestHelper {
  private summaryFile: string;
  private counters = { passed: 0, failed: 0 };

  constructor(summaryFile: string) {
    this.summaryFile = summaryFile;
    const dir = path.dirname(summaryFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  log(line: string): void {
    fs.appendFileSync(this.summaryFile, line + "\n");
  }

  record(title: string, ok: boolean, note?: string): void {
    if (ok) this.counters.passed++;
    else this.counters.failed++;
    this.log(`[${ok ? "PASS" : "FAIL"}] ${title}${note ? ` :: ${note}` : ""}`);
  }

  summary(): void {
    this.log(
      `---\nsummary passed=${this.counters.passed} failed=${this.counters.failed}\n`,
    );
  }

  async assertErrorThrown(
    fn: () => Promise<unknown>,
    expectedCode?: string,
    expectedMessage?: string,
  ): Promise<void> {
    let failureMsg: string | undefined;
    try {
      const result: any = await fn();
      // SDK's wait() returns a receipt with in_state=false on on-chain revert
      // instead of throwing. Treat that as a failure too.
      const inState =
        result?.data?.in_state ??
        result?.in_state;
      if (inState === false) {
        failureMsg =
          result?.data?.reason ?? result?.reason ?? "in_state is false";
      }
    } catch (e: any) {
      failureMsg = e?.message ?? String(e);
    }
    expect(failureMsg, "expected operation to revert or throw").to.not.be
      .undefined;
    if (expectedCode) expect(failureMsg!).to.include(expectedCode);
    if (expectedMessage) expect(failureMsg!).to.include(expectedMessage);
  }
}
