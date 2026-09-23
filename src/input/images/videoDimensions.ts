const DEFAULT_VIDEO_DIMENSIONS_TIMEOUT_MS = 10_000;

type VideoDimensionSource = {
  readonly videoWidth: number;
  readonly videoHeight: number;
  addEventListener(
    type: "loadedmetadata" | "error",
    listener: EventListener,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: "loadedmetadata" | "error",
    listener: EventListener,
    options?: EventListenerOptions | boolean,
  ): void;
};

export function waitForVideoDimensions(
  video: VideoDimensionSource,
  timeoutMs = DEFAULT_VIDEO_DIMENSIONS_TIMEOUT_MS,
): Promise<void> {
  if (hasVideoDimensions(video)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onLoadedMetadata: EventListener = () => {
      if (hasVideoDimensions(video)) {
        settle(resolve);
        return;
      }

      settle(() =>
        reject(
          new Error("Camera metadata loaded without usable video dimensions."),
        ),
      );
    };
    const onError: EventListener = () => {
      settle(() => reject(new Error("Camera video failed to load metadata.")));
    };
    const timeoutId = setTimeout(() => {
      settle(() =>
        reject(
          new Error(
            `Camera video dimensions were not available within ${timeoutMs} ms.`,
          ),
        ),
      );
    }, timeoutMs);

    function settle(result: () => void): void {
      clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
      result();
    }

    video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    video.addEventListener("error", onError, { once: true });

    // Avoid missing dimensions that became available between the first check
    // and listener registration.
    if (hasVideoDimensions(video)) {
      settle(resolve);
    }
  });
}

function hasVideoDimensions(video: VideoDimensionSource): boolean {
  return video.videoWidth > 0 && video.videoHeight > 0;
}
