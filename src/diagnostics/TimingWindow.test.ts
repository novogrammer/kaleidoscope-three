import { describe, expect, it } from "vitest";
import { TimingWindow } from "./TimingWindow";

describe("TimingWindow", () => {
  it("summarizes only the most recent samples", () => {
    const timings = new TimingWindow(3);

    timings.record(10);
    timings.record(20);
    timings.record(30);
    const summary = timings.record(40);

    expect(summary).toEqual({
      sampleCount: 3,
      totalSampleCount: 4,
      latestMilliseconds: 40,
      averageMilliseconds: 30,
      maximumMilliseconds: 40,
    });
  });

  it("rejects a non-positive capacity", () => {
    expect(() => new TimingWindow(0)).toThrow(RangeError);
  });
});
