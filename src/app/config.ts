export const INPUT_MODES = ["camera", "fixture"] as const;
export const FIXTURE_NAMES = ["face-center", "face-offset", "no-face"] as const;
export const MOCK_MODES = ["center", "enter-exit", "move"] as const;

export type InputMode = (typeof INPUT_MODES)[number];
export type FixtureName = (typeof FIXTURE_NAMES)[number];
export type MockMode = (typeof MOCK_MODES)[number];

export type AppConfig = {
  input: InputMode;
  fixture: FixtureName;
  mock: MockMode | null;
};

export function parseAppConfig(search: string): AppConfig {
  const parameters = new URLSearchParams(search);

  return {
    input: readValue(parameters, "input", INPUT_MODES) ?? "camera",
    fixture:
      readValue(parameters, "fixture", FIXTURE_NAMES) ?? "face-center",
    mock: readValue(parameters, "mock", MOCK_MODES),
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
