export const DISPLAY_OUTPUT_PREFERENCES = ["auto", "sdr", "hdr"] as const;

export type DisplayOutputPreference =
  (typeof DISPLAY_OUTPUT_PREFERENCES)[number];
export type DisplayOutputMode = "sdr" | "hdr";

export type DisplayOutputCapabilities = {
  webGpuAvailable: boolean;
  highDynamicRange: boolean;
};

export function shouldAttemptHdrOutput(
  preference: DisplayOutputPreference,
  capabilities: DisplayOutputCapabilities,
): boolean {
  if (!capabilities.webGpuAvailable || preference === "sdr") return false;
  return preference === "hdr" || capabilities.highDynamicRange;
}

export function readDisplayOutputCapabilities(): DisplayOutputCapabilities {
  return {
    webGpuAvailable:
      typeof navigator !== "undefined" && "gpu" in navigator,
    highDynamicRange:
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(dynamic-range: high)").matches,
  };
}
