# 顔万華鏡 three.js版
グループ展向けにopenFrameworks版やUnity版の顔万華鏡を作ってきた。<br>
three.js版にすることで静的ページとしてずっと展示できるようになる。<br>
Codexを利用して移植を行うが、任せきりにしない。<br>

## Live demo

https://novogrammer.github.io/kaleidoscope-three/

## 移植元

Unity版のソースリポジトリ

https://github.com/novogrammer/KaleidoscopeUnityHdr

## MediaPipeアセット

本体と`mediapipe-check`は、実行時にCDNやモデル配布元へ依存しない構成にする。

- 顔検出モデル: `src/assets/models/blaze_face_short_range.tflite`
- 取得元: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
- 配布バージョン: `float16/1`
- SHA-256: `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f`

モデルは公式配布元から手動で取得し、Viteの `?url` importでビルド成果物へ同梱する。モデルを更新するときは、取得元、バージョン、SHA-256も合わせて更新する。MediaPipeのWASMは、インストール済みの `@mediapipe/tasks-vision` からViteのビルド時に取り込む。

## 開発・検証用fixture

### `face-center.jpg`

- 配置先: `src/assets/fixtures/face-center.jpg`
- 生成元: `source-assets/fixtures/face-center.png`
- 用途: 正面顔のMediaPipe入力、およびカレイドスコープの描画テクスチャ
- 形式: JPEG、1024 × 1024、RGB、品質92
- 作成日: 2026-09-22
- 作成方法: OpenAIの画像生成機能で作成した架空人物。外部の人物写真や参照画像は使用していない
- 生成元PNGのSHA-256: `86a5adeb13650d895e72038407d2e15d6a073e043a3d757f4628d9984a2b1d74`
- 配信用JPEGのSHA-256: `fc154e3599e0352c2cdbdb7613a156fb3c201d320d866b171ba3cf76755cf844`

正面向きの成人、遮蔽のない顔、均一な照明、明るめのベージュからオリーブ系の肌を指定した。鏡映や回転方向を判別しやすくするため、背景の左右に青と珊瑚色の差を設けている。

### `face-offset.jpg`

- 配置先: `src/assets/fixtures/face-offset.jpg`
- 生成元: `source-assets/fixtures/face-offset.png`
- 用途: 画面中央から外れた顔のMediaPipe入力、および顔中心に追従する描画の確認
- 形式: JPEG、1024 × 1024、RGB、品質92
- 作成日: 2026-09-24
- 作成方法: OpenAIの画像生成機能で`face-center.jpg`の架空人物と撮影条件を参照し、顔中心が左寄りになるよう再構成した。外部の人物写真は使用していない
- 生成元PNGのSHA-256: `2cd01738517ea8e3b65a6beef92b571fa3286c7af4196735455bfff1c6451e1f`
- 配信用JPEGのSHA-256: `4b0a9dd8c194687de4f5b0fb3ffcbeeb4f91e11c4952746b351c2cfc8277ad54`

正面向き、遮蔽のない顔、均一な照明を維持し、顔中心を画像左側のおよそ28%の位置へ移した。右側には背景だけの領域を広く残している。

### `no-face.jpg`

- 配置先: `src/assets/fixtures/no-face.jpg`
- 生成元: `source-assets/fixtures/no-face.png`
- 用途: 顔未検出時のMediaPipe入力、および補助レイヤーだけで表示を継続する動作の確認
- 形式: JPEG、1024 × 1024、RGB、品質92
- 作成日: 2026-09-24
- 作成方法: OpenAIの画像生成機能で`face-center.jpg`の背景色と撮影条件を参照し、人物を含まない背景として再構成した。外部画像は使用していない
- 生成元PNGのSHA-256: `36b7b12399bc9824fe9e66e8d5c0626ff40c9249945208aeb97dc4f79225351f`
- 配信用JPEGのSHA-256: `3d9b0fc256ee17c2fa3129b6794807eeaa1df86d7191aae57ca161d9c542b5a8`

顔、人物、物体、文字を含めず、青、ラベンダー、珊瑚色の滑らかなスタジオ背景だけを残している。

`source-assets/`はViteの`root`である`src/`の外に置き、生成元や編集用アセットだけを管理する。ここにあるファイルはアプリからimportせず、ビルド成果物へ含めない。

## OGP画像

- 配置先: `public/ogp.jpg`
- 形式: JPEG、1200 × 630、SDR
- 撮影条件: `?input=fixture&mock=center&output=sdr&backend=webgl2`
- 使用素材: `face-center.jpg`とアプリの実描画
- 候補画像: `source-assets/ogp/ogp-candidate-01.jpg`、`source-assets/ogp/ogp-candidate-02-later.jpg`
- 採用画像: `ogp-candidate-02-later.jpg`

実画面を固定fixtureで撮影し、ステータス表示だけを除いている。HDRディスプレイやWebカメラ入力に依存せず、同じ見え方を確認できる条件にしている。
第1候補は開始約3.5秒後、第2候補は開始約7秒後に撮影した。候補画像はViteの配信対象外に置き、採用画像だけを`public/ogp.jpg`へ配置する。
