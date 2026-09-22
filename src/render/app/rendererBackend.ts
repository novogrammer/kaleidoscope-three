export const RENDERER_BACKEND_PREFERENCES = ["auto", "webgl2"] as const;

export type RendererBackendPreference =
  (typeof RENDERER_BACKEND_PREFERENCES)[number];
