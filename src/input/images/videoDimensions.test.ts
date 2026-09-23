import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForVideoDimensions } from "./videoDimensions";

class FakeVideo extends EventTarget {
  videoWidth = 0;
  videoHeight = 0;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("waitForVideoDimensions", () => {
  it("resolves immediately when dimensions are already available", async () => {
    const video = new FakeVideo();
    video.videoWidth = 1280;
    video.videoHeight = 720;

    await expect(waitForVideoDimensions(video)).resolves.toBeUndefined();
  });

  it("resolves after metadata supplies usable dimensions", async () => {
    const video = new FakeVideo();
    const result = waitForVideoDimensions(video);

    video.videoWidth = 640;
    video.videoHeight = 480;
    video.dispatchEvent(new Event("loadedmetadata"));

    await expect(result).resolves.toBeUndefined();
  });

  it("rejects when metadata loads without usable dimensions", async () => {
    const video = new FakeVideo();
    const result = waitForVideoDimensions(video);

    video.dispatchEvent(new Event("loadedmetadata"));

    await expect(result).rejects.toThrow(
      "Camera metadata loaded without usable video dimensions.",
    );
  });

  it("rejects when the video reports an error", async () => {
    const video = new FakeVideo();
    const result = waitForVideoDimensions(video);

    video.dispatchEvent(new Event("error"));

    await expect(result).rejects.toThrow(
      "Camera video failed to load metadata.",
    );
  });

  it("rejects after the configured timeout", async () => {
    vi.useFakeTimers();
    const video = new FakeVideo();
    const result = waitForVideoDimensions(video, 25);
    const rejection = expect(result).rejects.toThrow(
      "Camera video dimensions were not available within 25 ms.",
    );

    await vi.advanceTimersByTimeAsync(25);

    await rejection;
  });
});
