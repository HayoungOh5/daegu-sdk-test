import * as fs from "fs";
import * as path from "path";

const METRICS_DIR = path.join(__dirname, "..", "test", "0_metrics");
const CSV_HEADER =
  "timestamp,network,suite,test,op,duration_ms,block_height,ok,note\n";

export interface MetricContext {
  network: string;
  suite: string;
  test: string;
  blockHeight?: () => Promise<number | undefined>;
}

function csvFile(network: string): string {
  if (!fs.existsSync(METRICS_DIR)) fs.mkdirSync(METRICS_DIR, { recursive: true });
  const file = path.join(METRICS_DIR, `latency_${network}.csv`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, CSV_HEADER);
  return file;
}

function escape(v: string | number | undefined): string {
  if (v === undefined || v === null) return "";
  const s = String(v).replace(/"/g, '""').replace(/\n/g, " ");
  return /[,"]/.test(s) ? `"${s}"` : s;
}

export async function measure<T>(
  ctx: MetricContext,
  op: string,
  fn: () => Promise<T>,
  note?: string,
): Promise<T> {
  const started = Date.now();
  let ok = true;
  let result: T;
  let errMsg = "";
  try {
    result = await fn();
    return result;
  } catch (e: any) {
    ok = false;
    errMsg = e?.message ?? String(e);
    throw e;
  } finally {
    const duration = Date.now() - started;
    let block: number | undefined;
    try {
      block = ctx.blockHeight ? await ctx.blockHeight() : undefined;
    } catch (e: any) {
      process.stderr.write(`[metrics] blockHeight failed: ${e?.message ?? e}\n`);
    }
    const row =
      [
        new Date().toISOString(),
        ctx.network,
        ctx.suite,
        ctx.test,
        op,
        duration,
        block,
        ok ? 1 : 0,
        note ?? errMsg,
      ]
        .map(escape)
        .join(",") + "\n";
    fs.appendFileSync(csvFile(ctx.network), row);
  }
}
