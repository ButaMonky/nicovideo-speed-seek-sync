# ニコニコ速度制限解除＋外部シーク同期

**Nicovideo Speed + Seek Sync ? integrated userscript**

ニコニコ動画の再生速度同期と、外部からシークした際のプレイヤー内部時計同期を1本にまとめたUserscriptです。

- 統合版: **1.2.1**（1.2.0から公開・自動更新用メタデータを整備。動作ロジックの変更なし）
- 対象: `https://www.nicovideo.jp/watch/*` の通常視聴ページ
- 配布形式: Tampermonkey / Violentmonkey向けUserscript
- ライセンス: MIT。第三者由来部分の表示は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照。

## インストール

1. TampermonkeyまたはViolentmonkeyをインストールします。
2. [Userscriptを開いてインストール](https://raw.githubusercontent.com/ButaMonky/nicovideo-speed-seek-sync/main/nicovideo-speed-seek-sync.user.js)します。
3. ニコニコの視聴ページを再読み込みします。

### 重要：旧スクリプトとの併用禁止

この統合版を使う場合、次の単独版は両方とも無効にしてから、視聴ページ全体を再読み込みしてください。

- `Nicovideo speed limit unlocker` 単独版
- `Nicovideo External Seek Clock Sync` 単独版

統合版は二重フックを避けるため、旧版のフックが検出されると起動を中止します。旧版を残したまま同時に有効化しないでください。

## 機能

- 外部拡張などで変更された動画の再生速度を、ニコニコプレイヤー内部の速度状態へ同期
- 外部シーク後、動画を再シークせず、確認できたプレイヤー内部時計を同期
- 外部シーク時に内部補間時計が先行する表示の揺れを抑えるための限定的なホールド処理
- 二重インストール検出
- 診断レポートと、任意の計測API

このスクリプト自体は再生速度を変更するUIを提供しません。再生速度の変更には、別途Video Speed Controller等の外部操作手段が必要です。

## 診断

通常のニコニコ視聴ページの開発者コンソールから、次を実行できます。

```js
window.__NICO_EXTERNAL_SEEK_SYNC__?.report()
```

外部シーク同期部分だけを停止する場合:

```js
window.__NICO_EXTERNAL_SEEK_SYNC__?.stop()
```

`stop()` はシーク同期部分のみを停止します。速度同期も含めて完全に無効化する場合は、Tampermonkey/Violentmonkeyで統合版を無効にし、ページを再読み込みしてください。

## 更新

Userscriptの `@updateURL` と `@downloadURL` は、このリポジトリの `main` ブランチにある配布ファイルを指しています。

既に `@downloadURL none` の旧1.2.0を手動登録している場合、そのインストール済みコピーには自動で新しい更新先が追加されません。上記のGitHub配布リンクから1.2.1をインストールし、旧単独版と旧統合版を無効にしてください。重複したままにしないでください。

## 検証状況と制約

- 公開準備時に `node --check` によるJavaScript構文検査を実施。
- GitHub Actionsでは構文検査と配布メタデータの整合性を確認します。
- **実際のニコニコ本番ページ、Tampermonkey、Video Speed Controllerとの組合せでの1.2.1実機検証は未完了**です。動作を保証するものではありません。
- プレイヤー内部の非公開実装に依存します。ニコニコ側の更新で動作しなくなる可能性があります。
- 対応するのは通常の `/watch/{videoId}` ページです。広告・割込み・ネイティブシーク中・対応外のコンテンツ構成などは安全側に停止またはスキップします。
- このスクリプトは動画を再シークする処理、再生速度を直接変更する処理、ネットワーク通信、Cookieや認証情報の保存を行いません。速度モジュールはプレイヤーの `setPlaybackRate` 定義を監視するため、他の拡張機能との互換性には注意してください。

## ライセンスと第三者コード

本リポジトリのライセンスはMITです。速度同期モジュールには、Eluentyw氏の `Nicovideo speed limit unlocker` v1.1の関数本体が含まれています。同スクリプトもMITライセンスとして公開されているため、元作者の帰属とMIT表示を [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) に残しています。統合版全体を第三者由来部分まで含めて「すべて自作」とは表示しません。
