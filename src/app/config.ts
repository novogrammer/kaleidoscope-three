import {
  DISPLAY_OUTPUT_PREFERENCES,
  type DisplayOutputPreference,
} from "../render/app/displayOutput";
import {
  RENDERER_BACKEND_PREFERENCES,
  type RendererBackendPreference,
} from "../render/app/rendererBackend";

export const INPUT_MODES = ["camera", "fixture"] as const;
export const FIXTURE_NAMES = ["face-center", "face-offset", "no-face"] as const;
export const MOCK_MODES = ["center", "enter-exit", "move"] as const;
export const FACE_SCALE_MODES = ["fixed", "dynamic"] as const;
export const KALEIDOSCOPE_MODES = ["on", "off"] as const;

export type InputMode = (typeof INPUT_MODES)[number];
export type FixtureName = (typeof FIXTURE_NAMES)[number];
export type MockMode = (typeof MOCK_MODES)[number];
export type FaceScaleMode = (typeof FACE_SCALE_MODES)[number];
export type KaleidoscopeMode = (typeof KALEIDOSCOPE_MODES)[number];

export type AppConfig = {
  input: InputMode;
  fixture: FixtureName;
  mock: MockMode | null;
  faceScale: FaceScaleMode;
  kaleidoscope: KaleidoscopeMode;
  output: DisplayOutputPreference;
  backend: RendererBackendPreference;
};

export function parseAppConfig(search: string): AppConfig {
  const parameters = new URLSearchParams(search);

  return {
    input: readValue(parameters, "input", INPUT_MODES) ?? "camera",
    fixture:
      readValue(parameters, "fixture", FIXTURE_NAMES) ?? "face-center",
    mock: readValue(parameters, "mock", MOCK_MODES),
    faceScale:
      readValue(parameters, "faceScale", FACE_SCALE_MODES) ?? "dynamic",
    kaleidoscope:
      readValue(parameters, "kaleidoscope", KALEIDOSCOPE_MODES) ?? "on",
    output:
      readValue(parameters, "output", DISPLAY_OUTPUT_PREFERENCES) ?? "auto",
    backend:
      readValue(parameters, "backend", RENDERER_BACKEND_PREFERENCES) ??
      "auto",
  };
}

function readValue<const T extends readonly string[]>(
  parameters: URLSearchParams,
  name: string,
  choices: T,
): T[number] | null {
  const value = parameters.get(name);
  return value !== null && choices.includes(value) ? value : null;
}
