export type TimingSummary = Readonly<{
  sampleCount: number;
  totalSampleCount: number;
  latestMilliseconds: number;
  averageMilliseconds: number;
  maximumMilliseconds: number;
}>;

export class TimingWindow {
  readonly #capacity: number;
  readonly #samples: number[] = [];
  #totalSampleCount = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("TimingWindow capacity must be a positive integer.");
    }

    this.#capacity = capacity;
  }

  record(milliseconds: number): TimingSummary {
    this.#samples.push(milliseconds);
    this.#totalSampleCount += 1;

    if (this.#samples.length > this.#capacity) {
      this.#samples.shift();
    }

    return this.summary();
  }

  summary(): TimingSummary {
    const latestMilliseconds = this.#samples.at(-1);
    if (latestMilliseconds === undefined) {
      throw new Error("TimingWindow has no samples.");
    }

    const totalMilliseconds = this.#samples.reduce(
      (total, sample) => total + sample,
      0,
    );

    return {
      sampleCount: this.#samples.length,
      totalSampleCount: this.#totalSampleCount,
      latestMilliseconds,
      averageMilliseconds: totalMilliseconds / this.#samples.length,
      maximumMilliseconds: Math.max(...this.#samples),
    };
  }
}
