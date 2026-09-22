# 顔万華鏡 three.js版
グループ展向けにopenFrameworks版やUnity版の顔万華鏡を作ってきた。<br>
three.js版にすることで静的ページとしてずっと展示できるようになる。<br>
Codexを利用して移植を行うが、任せきりにしない。<br>
<br>
Unity版 https://github.com/novogrammer/KaleidoscopeUnityHdr

## MediaPipe確認用アセット

`mediapipe-check` は、実行時にCDNやモデル配布元へ依存しない構成にする。

- 顔検出モデル: `src/mediapipe-check/assets/blaze_face_short_range.tflite`
- 取得元: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
- 配布バージョン: `float16/1`
- SHA-256: `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f`

モデルは公式配布元から手動で取得し、Viteの `?url` importでビルド成果物へ同梱する。モデルを更新するときは、取得元、バージョン、SHA-256も合わせて更新する。MediaPipeのWASMは、インストール済みの `@mediapipe/tasks-vision` からViteのビルド時に取り込む。
