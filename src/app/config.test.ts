import { describe, expect, it } from "vitest";

import { parseAppConfig } from "./config";

describe("parseAppConfig", () => {
  it("uses the camera and no mock by default", () => {
    expect(parseAppConfig("")).toEqual({
      input: "camera",
      fixture: "face-center",
      mock: null,
      faceScale: "dynamic",
    });
  });

  it("uses the default fixture when only fixture input is specified", () => {
    expect(parseAppConfig("?input=fixture")).toEqual({
      input: "fixture",
      fixture: "face-center",
      mock: null,
      faceScale: "dynamic",
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
    });
  });

  it("can restore Unity-compatible fixed face scaling", () => {
    expect(parseAppConfig("?faceScale=fixed").faceScale).toBe("fixed");
  });

  it("falls back from unsupported values", () => {
    expect(
      parseAppConfig("?input=video&fixture=unknown&mock=random"),
    ).toEqual({
      input: "camera",
      fixture: "face-center",
      mock: null,
      faceScale: "dynamic",
    });
  });
});
