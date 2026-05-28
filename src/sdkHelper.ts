import * as path from "path";
import { Mitum } from "daegu-sdk";
import { MetricContext } from "./metrics";

export const SDK_ROOT = path.resolve(__dirname, "..", "..", "daegu_sdk");

export function scPath(...segments: string[]): string {
  return path.join(SDK_ROOT, ...segments);
}

export function makeBlockHeightFn(mitum: Mitum) {
  return async (): Promise<number | undefined> => {
    const info: any = await mitum.block.getAllBlocks(1, undefined, true);
    const h = info?.data?.[0]?._embedded?.Manifest?.height;
    return h !== undefined ? Number(h) : undefined;
  };
}

export function makeCtx(
  mitum: Mitum,
  network: string,
  suite: string,
): MetricContext {
  return {
    network,
    suite,
    test: "",
    blockHeight: makeBlockHeightFn(mitum),
  };
}
