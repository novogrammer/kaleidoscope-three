# 顔万華鏡 three.js版

グループ展向けに制作してきたopenFrameworks版、Unity版の顔万華鏡を、静的ページとして継続公開できるthree.js版へ移植する。

## Live demo

https://novogrammer.github.io/kaleidoscope-three/

## 移植元

Unity版のソースリポジトリ

https://github.com/novogrammer/KaleidoscopeUnityHdr

## ローカル実行

```bash
npm install
npm run dev
```

型チェックを含むプロダクションビルドと単体テストは、次のコマンドで実行する。

```bash
npm run build
npm test
```

## 開発・検証用URLパラメーター

画像入力と顔情報をURLクエリパラメーターで切り替えられる。パラメーターを省略した通常起動では、開始操作後に前面カメラとMediaPipeを使用する。

| パラメーター | 値 | 省略時 | 用途 |
| --- | --- | --- | --- |
| `input` | `camera`, `fixture` | `camera` | 前面カメラまたは静止画fixtureを選ぶ |
| `fixture` | `face-center`, `face-offset`, `no-face` | `face-center` | 使用する静止画を選ぶ |
| `mock` | `center`, `enter-exit`, `move` | 指定なし | 指定時はMediaPipeを省略し、モック顔情報を使用する |
| `faceScale` | `dynamic`, `fixed` | `dynamic` | 主レイヤーの三角形サイズを顔サイズへ連動、またはUnity版相当の固定値にする |
| `kaleidoscope` | `on`, `off` | `on` | `off`で万華鏡変換を迂回し、元画像と紙吹雪を直接確認する |
| `output` | `auto`, `sdr`, `hdr` | `auto` | HDR自動選択、SDR固定、HDR初期化の診断を切り替える |
| `backend` | `auto`, `webgl2` | `auto` | WebGPU優先の自動選択、またはWebGL 2固定にする |

代表的な確認用URLは次のとおり。

```text
?input=fixture&fixture=face-center
  中央の顔写真を背景とMediaPipe入力に使用する

?input=fixture&fixture=face-offset&output=sdr&backend=webgl2
  左寄りの顔への追従をWebGL 2＋SDRで確認する

?input=fixture&fixture=no-face&output=sdr&backend=webgl2
  顔未検出時も補助表示が継続することを確認する

?input=fixture&fixture=face-center&mock=enter-exit
  MediaPipeを省略し、顔の検出・喪失と1秒フェードを再現する

?input=fixture&fixture=no-face&mock=center
  顔のない画像と固定の顔情報を組み合わせ、画像入力と顔情報の分離を確認する

?input=camera&faceScale=fixed
  前面カメラを使い、Unity版相当の固定サイズで比較する

?input=fixture&fixture=face-center&kaleidoscope=off
  万華鏡変換を迂回し、元画像と紙吹雪へBloomを適用した状態を確認する
```

`backend=webgl2`と`output=hdr`を同時に指定した場合はWebGL 2が優先され、SDR出力になる。

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
- 撮影タイミング: 描画開始から約7秒後
- 使用素材: `face-center.jpg`とアプリの実描画
- 生成元: `source-assets/ogp/ogp-candidate-02-later.jpg`
- 加工: ステータス表示だけを除去

HDRディスプレイやWebカメラ入力に依存せず、同じ見え方を確認できる条件にしている。
