import { describe, expect, it } from "vitest";

import { parseAppConfig } from "./config";

describe("parseAppConfig", () => {
  it("uses the camera and no mock by default", () => {
    expect(parseAppConfig("")).toEqual({
      input: "camera",
      fixture: "face-center",
      mock: null,
      faceScale: "dynamic",
      output: "auto",
      backend: "auto",
    });
  });

  it("uses the default fixture when only fixture input is specified", () => {
    expect(parseAppConfig("?input=fixture")).toEqual({
      input: "fixture",
      fixture: "face-center",
      mock: null,
      faceScale: "dynamic",
      output: "auto",
      backend: "auto",
    });
  });

  it("accepts a fixture and mock combination", () => {
    expect(
      parseAppConfig("?input=fixture&fixture=face-offset&mock=enter-exit"),
    ).toEqual({
      input: "fixture",
      fixture: "face-offset",
      mock: "enter-exit",
      faceScale: "dynamic",
      output: "auto",
      backend: "auto",
    });
  });

  it("can restore Unity-compatible fixed face scaling", () => {
    expect(parseAppConfig("?faceScale=fixed").faceScale).toBe("fixed");
  });

  it("accepts explicit HDR and SDR output overrides", () => {
    expect(parseAppConfig("?output=hdr").output).toBe("hdr");
    expect(parseAppConfig("?output=sdr").output).toBe("sdr");
  });

  it("can force the WebGL 2 renderer backend", () => {
    expect(parseAppConfig("?backend=webgl2").backend).toBe("webgl2");
  });

  it("falls back from unsupported values", () => {
    expect(
      parseAppConfig("?input=video&fixture=unknown&mock=random"),
    ).toEqual({
      input: "camera",
      fixture: "face-center",
      mock: null,
      faceScale: "dynamic",
      output: "auto",
      backend: "auto",
    });
  });
});
