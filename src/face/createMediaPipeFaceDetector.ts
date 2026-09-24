import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import wasmSimdBinaryPath from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import wasmSimdLoaderPath from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import wasmNoSimdBinaryPath from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";
import wasmNoSimdLoaderPath from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import modelAssetPath from "../assets/models/blaze_face_short_range.tflite?url";

export type MediaPipeRunningMode = "IMAGE" | "VIDEO";

export async function createMediaPipeFaceDetector(
  runningMode: MediaPipeRunningMode,
): Promise<FaceDetector> {
  const isSimdSupported = await FilesetResolver.isSimdSupported();
  const vision = isSimdSupported
    ? {
        wasmLoaderPath: wasmSimdLoaderPath,
        wasmBinaryPath: wasmSimdBinaryPath,
      }
    : {
        wasmLoaderPath: wasmNoSimdLoaderPath,
        wasmBinaryPath: wasmNoSimdBinaryPath,
      };

  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath,
      delegate: "CPU",
    },
    runningMode,
    minDetectionConfidence: 0.5,
    minSuppressionThreshold: 0.3,
  });
}
