# KaleidoscopeUnityHdr three.js移植の前提

## この文書の目的

`KaleidoscopeUnityHdr`をthree.jsへ移植するにあたり、移植元から確認できた事実、初期方針、未決定事項を整理する。

この文書は実装仕様ではない。設計や検証によって判断が変わった場合は更新する。

## 参照元

移植元のUnityプロジェクトは、次のリポジトリ相対パスにあるシンボリックリンクから参照する。

```text
references/KaleidoscopeUnityHdr
```

`references/`は読み取り専用の参照元として扱い、移植作業によってUnityプロジェクトを変更しない。three.js版の実装とドキュメントは、このリポジトリ側に作成する。

## 作品の概要

移植元は「顔万華鏡HDR」というインタラクティブ作品で、2024年8月31日のSNACKS Vol.6向けに制作されている。

作品の中心的な意図は、HDRディスプレイの非常に強い輝度を、色付きパーティクルと万華鏡表現によって体験させることにある。そのため、単にSDR画面でBloomを再現するだけでなく、対応環境で実際にHDR出力することが作品性に関わる。

安全面では、強い光、点滅、高輝度の色変化が視聴者へ負担を与える可能性を前提とする。Unity版にも「テレビを見る時は部屋を明るくして離れて見て下さい」という注意書きがある。Web版でも、表示開始前の警告やHDR開始操作などを検討する。

## 移植元から確認できた構成

### 基盤

- Unity `6000.0.10f1`
- Universal Render Pipeline `17.0.3`
- Visual Effect Graph `17.0.3`
- Unity Input System `1.8.2`
- TensorFlow Lite Unity Sample由来のMediaPipe顔検出・顔ランドマーク処理
- Webカメラ入力

### シーンの処理フロー

確認できた主要な流れは次のとおり。

```text
Webカメラ映像
  ├─ MediaPipe/TFLiteによる顔検出・顔ランドマーク推定
  │    └─ 顔検出位置を万華鏡の中心へ反映
  └─ 背景映像として描画

VFX Graphによる紙吹雪パーティクル
  ↓
カメラのカラー出力
  ↓
URP Full Screen Passによる万華鏡変換
  ↓
Bloom
  ↓
HDRトーンマッピング／HDRディスプレイ出力
```

### 顔検出

`FaceMeshController.cs`では、次のモデルを使用している。

- `mediapipe/face_detection_front.tflite`
- `mediapipe/face_landmark.tflite`

検出した顔矩形の中心を、万華鏡マテリアルの`_center01`へ渡している。顔を検出すると主効果が1秒でフェードインし、見失うと1秒でフェードアウトする。

顔メッシュ自体は作成されるが、現在のシーン設定ではデバッグ描画が無効であり、作品の主要出力には使用されていないように見える。移植初期では、468点の顔メッシュ全体ではなく、顔検出中心の取得を必須範囲とするのが妥当である。

### 万華鏡処理

万華鏡はURPの`Full Screen Pass Renderer Feature`として登録され、ポストプロセス前に実行されている。カメラのカラーバッファを取得し、`KaleidoscopeShaderGraph.shadergraph`で加工する。

中核のHLSLは`CustomFunctions.hlsl`にあり、主に次の処理から成る。

- アスペクト比を考慮したUV変換
- 六角形格子への座標反復
- 60度単位の折り返しによる万華鏡座標
- 座標回転
- 円形マスク

万華鏡レイヤーは3系統ある。

- `01`: 顔検出位置を中心とし、検出状態に応じて半径と単位長がフェードする主レイヤー
- `02`: 画面中心から斜めにずれた位置を往復し、`sin(time)`で変化する補助レイヤー
- `03`: 別の斜め方向を往復し、`cos(time)`で変化する補助レイヤー

主レイヤーの確認済み制御値は次のとおり。

- フェード時間: `1.0`秒
- 最大半径: `1.0`
- 単位長の最大係数: `0.65`

補助レイヤーは次の値を使用している。

- 中心オフセット: `(0.4, 0.4)`
- 位相角速度: `10度/秒`
- 最大半径: `0.75`
- 単位長の最大係数: `0.2`

### 紙吹雪

`Confetti.vfx`によるGPUパーティクルシステムがシーンに含まれる。容量は`1000`で、専用の`ConfettiShaderGraph.shadergraph`が使われている。

UnityのVFX GraphをWebへ直接移植することはできないため、パーティクルの生成、更新、寿命、配置、色、描画形状を読み解き、three.jsのGPUパーティクルとして再構成する必要がある。

### HDRとポストプロセス

Unity版ではHDR出力が明示的に有効化されている。

- Project Settingsの`allowHDRDisplaySupport`: 有効
- Project Settingsの`useHDRDisplay`: 有効
- カメラのHDR: 有効
- `SystemController.cs`から`RequestHDRModeChange(true)`を実行
- URP AssetのHDR: 有効

Volume Profileで確認できる主要な値は次のとおり。

- Bloom: 有効
- Bloom threshold: `1.0`
- Bloom intensity: `0.25`
- Bloom scatter: `0.5`
- Bloom high-quality filtering: 有効
- Tonemapping: 有効（シリアライズ値 `mode = 2`）
- ACES preset: シリアライズ値 `3`
- Paper white: `234 nits`、自動検出有効
- 輝度範囲: `0.005–1000 nits`、自動検出有効

赤い発光マテリアルではEmission Colorに`(3, 0, 0)`が設定されており、`1.0`を超える線形輝度値を実際に使用している。

## three.js版の初期方針

### レンダラーとシェーダー

- `WebGPURenderer`を第一候補とする。
- WebGPUを利用できない環境に向けて、WebGL 2バックエンドへのフォールバックを対応範囲に含める。
- ShaderLab、Shader Graph、HLSLを直接流用せず、TSL（Three.js Shading Language）へ移植する。
- 万華鏡処理はTSL関数として分割し、UnityのFull Screen Passに相当する画面パスとして構成する。
- three.jsとTSLはAPI変更があり得るため、実装開始時にバージョンを固定する。
- WebGPUとWebGL 2で可能な限り同じTSL実装とアプリケーションロジックを共有する。
- WebGL 2では万華鏡、紙吹雪、顔追跡、HDR内部処理、SDR出力までを対象とする。HDRディスプレイ出力までWebGPUと同等になることは前提にしない。

### Webカメラと顔検出

- 前面カメラを使用し、`navigator.mediaDevices.getUserMedia()`へ`facingMode: "user"`を指定する。
- カメラ利用にはHTTPSまたはlocalhost、ユーザー許可、開始のためのユーザージェスチャーが必要になる。
- 顔検出には`@mediapipe/tasks-vision`の`FaceDetector`と、前面カメラの近距離撮影向けに最適化された`BlazeFace (short-range)`を使用する。
- `FaceDetector`が返す顔矩形から中心座標を求め、万華鏡の中心へ渡す。6点の簡易ランドマークは基本的に使用しない。
- 初期移植で必要なのは顔矩形または顔中心であり、顔メッシュ全点の再現は必須としない。
- 描画更新と顔検出の頻度を分離し、顔検出は10〜15fps程度を初期値とする。必要に応じてWeb Workerの利用を検討する。
- カメラ映像は鏡のように左右反転して表示する。CSSやシェーダーによる表示上の反転と、検出結果の座標変換を混同しない。
- カメラを拒否した場合や顔を検出できない場合でも、補助レイヤーによって表示が継続できるようにする。

### HDRの定義

本プロジェクトではHDRを次の3段階に分ける。

1. シェーダー内部で`1.0`を超える線形輝度値を保持する。
2. Half FloatなどのHDRバッファ上でBloomや合成を行い、SDR画面へトーンマッピングする。
3. 対応ブラウザ、OS、ディスプレイへHDRとして出力する。

移植の基礎として1と2を成立させる。ただし作品意図を考慮し、3も最終的な検証対象とする。HDR非対応環境ではSDR表示へフォールバックし、HDR出力中かどうかを利用者へ示せる設計が望ましい。

### ポストプロセス

- `RenderPipeline`とTSLベースのポストプロセスを第一候補とする。
- Bloomはトーンマッピングより前のHDR値に適用する。
- 色空間変換と出力変換は処理経路の最後に一度だけ適用する。
- 初期のBloomパラメーターはUnity版を基準にするが、アルゴリズム差があるため数値一致ではなく視覚比較で調整する。
- HDR表示とSDR表示で出力変換を分ける。

### 紙吹雪

- Unity VFX Graphの挙動は、WebGPU ComputeやGPGPUに依存しない方式で再構成する。
- 最初からVFX Graph全体を機械的に変換せず、見た目に寄与するパラメーターと更新式を抽出する。
- WebGPUとWebGL 2で共通利用できる実装を優先する。
- パーティクル状態はCPUで更新し、`InstancedMesh`でまとめて描画する。
- パーティクル数はUnity版の容量`1000`を初期上限とし、CPU更新方式で十分な性能が得られるか検証する。

## Unityからthree.jsへの対応

| Unity側 | three.js／Web側の候補 |
| --- | --- |
| URP Camera Color | TSLのscene pass／color texture |
| Full Screen Pass Renderer Feature | TSLによるフルスクリーンポストプロセス |
| Shader Graph / HLSL | Node Material / TSL |
| Material Properties | uniformノードとアプリケーション状態 |
| `_Time` | 時間ノードまたは毎フレーム更新するuniform |
| `_ScreenParams` | viewport sizeとpixel ratio |
| VFX Graph | CPU更新＋`InstancedMesh` |
| Volume Bloom | TSL Bloomノード |
| URP Tonemapping | three.jsのトーンマッピングまたは独自出力ノード |
| WebCam Texture | `getUserMedia()`と`VideoTexture` |
| TFLite Unityの顔検出・顔ランドマーク | MediaPipe Face Detector＋BlazeFace short-range |
| `HDROutputSettings` | Canvas/WebGPUのHDR出力設定と能力検出 |

この表は概念上の対応であり、APIの一対一変換を意味しない。

## 移植時の注意点

- Unityとthree.jsで、UV原点、カメラ映像の反転、画面座標、クリップ空間の差を確認する。
- Unity版の`InputTransformMatrix`が担うクロップ、回転、ミラーリング、アスペクト補正をWeb側でも再現する。
- 中間バッファが8bitになると発光値が失われるため、各パスの形式を検証する。
- 色空間変換、Bloom、トーンマッピングの順序を維持する。
- Unity版のHDR出力とWebのHDR出力では単位や表示変換が同一とは限らないため、対応ディスプレイ上で実測・目視比較する。
- フレームレート依存のアニメーションを避け、経過時間を基準にする。
- 高DPI環境ではpixel ratioの上限を設け、GPU負荷を管理する。
- Webカメラと顔推論は描画とは別の更新頻度にできるよう設計する。
- 強い発光や点滅に対する警告、停止手段、輝度を抑える手段を用意する。

## 段階的な移植案

1. カメラ映像なしで紙吹雪と万華鏡の静的な基準画面を作る。
2. `CustomFunctions.hlsl`の座標処理をTSLへ移植し、Unity版と座標結果を比較する。
3. HDR中間バッファ、Bloom、SDRトーンマッピングを構築する。
4. 紙吹雪の生成・更新・色・描画を再現する。
5. Webカメラ入力と顔中心の追跡を追加する。
6. 顔検出時の1秒フェードと2つの補助レイヤーを再現する。
7. 対応環境でHDRディスプレイ出力を検証し、SDRフォールバックと表示状態を整える。
8. Unity版との比較、性能調整、安全面のUIを行う。

## 初期の完了条件

- 紙吹雪、背景映像、3系統の万華鏡効果が確認できる。
- 顔の位置に主万華鏡レイヤーが追従する。
- 顔の検出・喪失に伴うフェードがUnity版と同様に動く。
- `1.0`を超える発光値がBloom適用まで保持される。
- SDR環境で自然にトーンマッピングされる。
- 対応環境ではHDR出力の有効化と判定を確認できる。
- カメラ拒否、顔未検出、WebGPU非対応時の挙動が定義されている。
- WebGPU非対応時にWebGL 2へフォールバックし、HDRディスプレイ出力を除く主要表現が維持される。
- リサイズ、高DPI、主要なデスクトップブラウザで破綻しない。

## 未決定事項

- 対象ブラウザ、OS、GPU、モバイル対応範囲
- HDR非対応環境で保証する最低品質
- Unity版との一致基準を、ピクセル一致とするか視覚的同等性とするか
- 輝度警告、開始確認、輝度制限をどのUIで提供するか
- HDR表示検証に使用する基準ディスプレイと撮影・測定方法

## 参考資料

- [Three.js Shading Language](https://threejs.org/tsl/)
- [WebGPURenderer](https://threejs.org/manual/en/webgpurenderer.html)
- [Post-Processing with WebGPURenderer](https://threejs.org/manual/en/webgpu-postprocessing.html)
- [three.js WebGPU HDR example](https://threejs.org/examples/webgpu_hdr.html)
- [Unity URP HDR output](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@17.0/manual/post-processing/hdr-output.html)
- [MediaPipe Face Detector](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector)
- [MediaPipe Face Detector for Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js)
