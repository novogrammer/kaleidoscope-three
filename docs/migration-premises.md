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

安全面では、強い光、点滅、高輝度の色変化が視聴者へ負担を与える可能性を前提とする。Unity版にも「テレビを見る時は部屋を明るくして離れて見て下さい」という注意書きがある。

Web版では、描画開始前の開始画面に輝度警告を表示する。複雑な設定画面は設けず、警告文を読める状態で開始ボタンを配置する。開始ボタンの押下後に、カメラ権限の要求と作品の描画を開始する。

警告文は、少なくとも強い光や点滅を含むことと、明るい部屋で画面から離れて閲覧することを伝える。

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
- three.jsは実装開始時点の最新安定版を採用し、そのバージョンに固定する。
- WebGPUとWebGL 2で可能な限り同じTSL実装とアプリケーションロジックを共有する。
- WebGL 2では万華鏡、紙吹雪、顔追跡、HDR内部処理、SDR出力までを対象とする。HDRディスプレイ出力までWebGPUと同等になることは前提にしない。

### 開発環境

- Vite
- TypeScript
- Vitest
- Vitestはブラウザを必要としないロジックの単体テストを中心に使用する。
- 依存パッケージの具体的なバージョンは、実装開始時の互換性を確認して固定する。

### 実行時アセットの配信

- 公開したアプリの実行時には、CDNや外部のモデル配布元へ依存しない。
- MediaPipeのWASM、顔検出モデル、静止画fixtureなど、実行に必要なアセットはアプリと同じ配信元から提供する。
- npmパッケージに含まれるWASMは、インストール済みパッケージからViteのビルド時に取り込む。
- npmパッケージに含まれないモデルやfixtureはリポジトリ内で管理し、Viteのアセットとしてビルド成果物へ同梱する。
- npmによる開発時の依存取得や、モデル更新時の公式配布元からの手動取得は許容する。外部取得を必要としないのは、ビルド済みアプリの実行時である。
- 同梱する外部アセットの具体的な配置場所、取得元、バージョン、ハッシュは`README.md`に記録する。

### 対象ブラウザ

次のブラウザの最新安定版を対応対象とする。過去バージョンへの互換性は保証対象に含めない。

- デスクトップ版Google Chrome
- デスクトップ版Safari
- デスクトップ版Firefox
- Android版Google Chrome
- iOS版Safari

特定のGPU機種、GPUベンダー、性能クラスは保証条件に含めない。対象ブラウザを通常利用でき、WebGPUまたはWebGL 2が利用可能な一般的な端末を前提とする。

WebGPU、HDRディスプレイ出力、MediaPipeの性能はブラウザと端末によって異なるため、すべての対象で同一機能を前提としない。WebGPUを利用できない場合はWebGL 2へ、HDRディスプレイ出力を利用できない場合はSDR出力へフォールバックする。GPU性能が不足する場合の細かな品質段階や機種別最適化は、初期対応の範囲外とする。

### Webカメラと顔検出

- 前面カメラを使用し、`navigator.mediaDevices.getUserMedia()`へ`facingMode: "user"`を指定する。
- カメラ利用にはHTTPSまたはlocalhost、ユーザー許可、開始のためのユーザージェスチャーが必要になる。
- 顔検出には`@mediapipe/tasks-vision`の`FaceDetector`と、前面カメラの近距離撮影向けに最適化された`BlazeFace (short-range)`を使用する。
- `FaceDetector`が返す顔矩形から中心座標を求め、万華鏡の中心へ渡す。6点の簡易ランドマークは基本的に使用しない。
- 初期移植で必要なのは顔矩形または顔中心であり、顔メッシュ全点の再現は必須としない。
- 描画更新と顔検出の頻度を分離し、顔検出は10〜15fps程度を初期値とする。必要に応じてWeb Workerの利用を検討する。
- カメラ映像は鏡のように左右反転して表示する。CSSやシェーダーによる表示上の反転と、検出結果の座標変換を混同しない。
- カメラを拒否した場合や顔を検出できない場合でも、補助レイヤーによって表示が継続できるようにする。

### 開発・検証用の入力

開発中やCodexによるブラウザ検証では、Webカメラを必須にしない。カメラ権限、実行環境、照明、人物の位置による不安定さを避けるため、URLクエリパラメーターで入力を切り替える。検証のためにソースコードを書き換えない。

描画内容そのものがカメラ画像を利用するため、次の2点を分けて構成する。

- **画像入力**: 万華鏡の元画像として描画する画素を供給する。
- **顔情報**: 万華鏡の中心、顔の有無、フェード状態を制御する。

静止画fixtureを使用するときは、同じ画像を描画テクスチャとMediaPipeへの入力の両方に再利用する。モック顔情報のために別のテクスチャを用意する必要はない。MediaPipeを省略する場合も、背景には選択中の静止画fixtureを表示し続ける。

想定するURLパラメーターは次のとおり。

| パラメーター | 値の例 | 用途 |
| --- | --- | --- |
| `input` | `camera`, `fixture` | 画像入力を前面カメラまたは静止画へ切り替える |
| `fixture` | `face-center`, `face-offset`, `no-face` | 使用する静止画fixtureを選択する |
| `mock` | `center`, `enter-exit`, `move` | 指定時だけMediaPipeを省略し、モック顔情報へ切り替える |

省略時の動作は次のとおり。

- `input`省略時は`camera`とする。ただしカメラを即座に起動せず、開始画面で利用者が操作した後に権限を要求する。
- `input=fixture`で`fixture`を省略した場合は`face-center`とする。
- `mock`省略時は、選択した画像入力に対してMediaPipe Face Detectorを使用する。

代表的な組み合わせは次のとおり。

```text
?input=fixture&fixture=face-center
  同じ顔写真を背景とMediaPipe入力に使う結合確認

?input=fixture&fixture=face-center&mock=center
  同じ顔写真を背景に使い、顔中心だけ固定値にして描画を確認

?input=fixture&fixture=face-center&mock=enter-exit
  同じ顔写真を背景に使い、検出・喪失と1秒フェードを再現

?input=camera
  前面カメラによる本番相当の手動確認
```

通常の開発とCodexによる軽い検証では`input=fixture`を使用する。通常利用時のカメラは、開始画面で利用者が明示的に開始した後だけ起動する。

静止画fixtureは、利用条件が明確でリポジトリに配置できる顔写真を使用する。個人の写真や利用条件が不明な画像は含めない。最低限、次のケースを用意する。

- 正面に1人の顔がある基準画像
- 顔がない画像
- 顔が画面中央から外れた画像

従来の画像処理で使われてきたLena／Lenna画像は採用しない。元画像の再配布条件が明確なfixture向けライセンスではなく、被写体本人も利用終了を望んでいる。fixtureには画像生成AIで作成した架空人物の顔写真を使用する。画像は実装上必要になった時点で作成し、この前提整理の段階では生成しない。

顔検出と描画を直接結合せず、検出結果を正規化した共通データとして描画側へ渡す。

```ts
type FaceObservation = {
  center: { x: number; y: number };
  size: { width: number; height: number };
  confidence: number;
  detected: boolean;
};
```

MediaPipeとモック入力のどちらを使っても、描画側はこの共通データだけを参照する。モック入力では顔の出現・消失や中心座標の移動を時間列として与え、1秒フェードと追従を再現可能な形で検証する。

### HDRの定義

本プロジェクトではHDRを次の3段階に分ける。

1. シェーダー内部で`1.0`を超える線形輝度値を保持する。
2. Half FloatなどのHDRバッファ上でBloomや合成を行い、SDR画面へトーンマッピングする。
3. 対応ブラウザ、OS、ディスプレイへHDRとして出力する。

移植の基礎として1と2を成立させる。ただし作品意図を考慮し、3も最終的な検証対象とする。HDR非対応環境ではSDR表示へフォールバックし、HDR出力中かどうかを利用者へ示せる設計が望ましい。

HDRを利用できない環境では、特別な高品質基準やHDR相当の眩しさまでは保証しない。SDRとして普通に閲覧でき、カメラ画像、紙吹雪、万華鏡、発光感が判別でき、極端な白飛び、黒潰れ、色化けなどで主要表現が破綻しないことを最低保証とする。

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

## 開発中の検証方針

Codexによるブラウザ操作、画面キャプチャ、画像の目視確認はトークン消費が大きいため、変更のたびには行わない。通常の開発ではブラウザを起動しない検証を優先し、ブラウザ確認は意味のある節目にまとめる。

### 頻繁に行う検証

次の検証は変更に応じて頻繁に実行する。

- TypeScriptの型チェック
- Lintとフォーマット確認
- プロダクションビルド
- URLクエリパラメーターの解析と既定値の単体テスト
- `FaceObservation`の正規化、左右反転、アスペクト補正の単体テスト
- 顔の出現・喪失に伴う1秒フェードの単体テスト
- 紙吹雪のCPU更新ロジックの単体テスト
- 固定時刻と固定乱数seedを使った、パーティクル状態の再現性テスト
- 万華鏡の座標計算について、既知の入力と出力を比較するテスト

これらの単体テストにはVitestを使用する。

TSL上でのみ動く処理についても、可能な範囲で同じ数式のCPU参照実装または代表値を用意し、ブラウザを使わずに座標やパラメーターを検証できるようにする。

### ブラウザ確認を行う節目

ブラウザ確認は、原則として次のタイミングに限定する。

- 初めて画面が描画できる状態になったとき
- 万華鏡のTSL移植が一通り接続されたとき
- HDR中間処理、Bloom、トーンマッピングを接続したとき
- `InstancedMesh`による紙吹雪を接続したとき
- MediaPipeと静止画fixtureを初めて接続したとき
- WebGL 2フォールバックを初めて確認するとき
- 大きな描画変更の後
- 作業の完了前

小さなリファクタリング、型修正、単体テストで十分に確認できる変更では、ブラウザ確認を省略する。

### ブラウザ確認のコストを抑える方法

- 通常は`?input=fixture`を使用し、カメラ権限と実時間入力を避ける。
- 固定viewport、固定時刻、固定乱数seedを使用する。
- 最初は代表的な1画面だけを確認し、必要が生じた場合にのみ追加ケースを見る。
- WebGPUとWebGL 2の両方を毎回確認せず、通常は主経路だけを確認する。
- スクリーンショット比較は視覚変更または回帰確認が必要なときだけ行う。
- ブラウザのコンソールエラーと主要な状態値を先に確認し、画像確認が必要か判断する。
- 実カメラ、HDRディスプレイ、複数ブラウザの確認は、節目で行う手動検証として扱う。

### HDR表示の確認

- HDR表示は、開発時に使用しているHDR対応のMacBook Proで手動確認する。
- HDRディスプレイ出力の自動検証は必須としない。
- 自動化可能性は実装後に確認するが、自動化できないことを完了の妨げにしない。
- 自動テストではHDR内部値、出力モードの分岐、SDRフォールバックまでを確認し、実際の輝度と見え方は実機で確認する。

## 段階的な移植案

0. 開始画面、URLパラメーター解析、WebGPU／WebGL 2レンダラー、リサイズ処理、最小限の基準描画から成るアプリ基盤を作る。
1. 静止画fixtureを描画テクスチャとして使い、モック顔情報によって紙吹雪と万華鏡の静的な基準画面を作る。
2. `CustomFunctions.hlsl`の座標処理をTSLへ移植し、Unity版と座標結果を比較する。
3. HDR中間バッファ、Bloom、SDRトーンマッピングを構築する。
4. 紙吹雪の生成・更新・色・描画を再現する。
5. 静止画fixtureとMediaPipe Face Detectorを接続し、顔中心と座標変換を検証する。
6. モック入力で顔検出時の1秒フェード、中心移動、2つの補助レイヤーを再現する。
7. 前面カメラ入力を追加し、実時間の顔追跡を手動確認する。
8. 対応環境でHDRディスプレイ出力を検証し、SDRフォールバックと表示状態を整える。
9. Unity版との比較、性能調整、安全面のUIを行う。

## 初期の完了条件

- 紙吹雪、背景映像、3系統の万華鏡効果が確認できる。
- 顔の位置に主万華鏡レイヤーが追従する。
- 顔の検出・喪失に伴うフェードがUnity版と同様に動く。
- 静止画fixtureを描画テクスチャとして使い、MediaPipeまたはモック顔情報と組み合わせて主要な描画を再現可能に検証できる。
- URLクエリパラメーターだけで、静止画fixture、モック顔情報、前面カメラを切り替えられる。
- 前面カメラを許可しなくてもアプリケーションを起動できる。
- `1.0`を超える発光値がBloom適用まで保持される。
- SDR環境で自然にトーンマッピングされる。
- 対応環境ではHDR出力の有効化と判定を確認できる。
- カメラ拒否、顔未検出、WebGPU非対応時の挙動が定義されている。
- WebGPU非対応時にWebGL 2へフォールバックし、HDRディスプレイ出力を除く主要表現が維持される。
- リサイズ、高DPI、主要なデスクトップブラウザで破綻しない。

Unity版とのピクセル単位またはパラメーター値の厳密な一致は求めない。作品の構成、顔への追従、万華鏡の動き、紙吹雪、HDR発光という主要な視覚体験が保たれることを目標とする。

## 未決定事項

現時点で、実装開始を妨げる未決定事項はない。細部の数値、文言、レイアウトは実装と検証の過程で調整する。

## 参考資料

- [Three.js Shading Language](https://threejs.org/tsl/)
- [WebGPURenderer](https://threejs.org/manual/en/webgpurenderer.html)
- [Post-Processing with WebGPURenderer](https://threejs.org/manual/en/webgpu-postprocessing.html)
- [three.js WebGPU HDR example](https://threejs.org/examples/webgpu_hdr.html)
- [Unity URP HDR output](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@17.0/manual/post-processing/hdr-output.html)
- [MediaPipe Face Detector](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector)
- [MediaPipe Face Detector for Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js)
- [Vitest](https://vitest.dev/guide/)
- [IEEE Author Center: Lena Image](https://conferences.ieeeauthorcenter.ieee.org/write-your-paper/improve-your-graphics/)
