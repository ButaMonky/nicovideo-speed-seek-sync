# ニコニコ速度制限解除＋外部シーク同期

**Nicovideo Speed + Seek Sync — integrated userscript**

ニコニコ動画のプレイヤーと、外部の再生速度・シーク操作との間で生じる同期ずれを抑えるためのUserscriptです。速度同期と外部シーク後の内部時計同期を1本にまとめています。

<details>
<summary>リリース情報</summary>

| 項目 | 内容 |
|---|---|
| バージョン | **1.2.2** |
| 対象 | ニコニコ動画の通常視聴ページ `https://www.nicovideo.jp/watch/*` |
| 対応マネージャー | Tampermonkey / Violentmonkey |
| 配布形式 | 単一のUserscript |
| ライセンス | MIT（第三者コードの表示は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)） |
| 更新元 | このリポジトリの `main` ブランチ |
| 実機検証 | 現行ニコニコ本番環境での1.2.2検証は未完了 |

</details>

## まずインストールする

**[Userscriptをインストールする](https://raw.githubusercontent.com/ButaMonky/nicovideo-speed-seek-sync/main/nicovideo-speed-seek-sync.user.js)**

インストール後、ニコニコの視聴ページを再読み込みしてください。旧版を使っていた場合は、先に下記の「旧版からの移行」を確認してください。

- [使い方・導入手順](#導入手順)
- [旧版からの移行](#旧版からの移行)
- [機能と仕組み](#機能と仕組み)
- [更新方法](#更新方法)
- [トラブルシューティング](#トラブルシューティング)

## このスクリプトでできること

### 1. 再生速度の同期

外部の速度変更ツールなどがHTMLVideoElementの再生速度を変更したとき、その値をニコニコプレイヤー内部の速度状態へ反映します。

**このUserscript自体に速度変更ボタンや速度選択UIはありません。** 速度を変更するには、動画の `playbackRate` を変更する別の拡張機能・操作手段が必要です。

### 2. 外部シーク後の内部時計同期

外部ツールから動画をシークした際、動画要素の再生位置とニコニコプレイヤー内部の基準時刻・補間時計がずれる場合があります。その差を、確認できたプレイヤー内部の時計側で補正します。

動画そのものをもう一度シークして位置を動かす方式ではありません。ネイティブのシーク処理やプレイヤー自身の時間同期が進行中の場合は、競合を避けるため処理を見送ります。

### 3. 表示時刻の揺れを抑える処理

外部シーク直後に内部の補間時計だけが先行するケースに対して、対象を限定した一時的なホールド処理を行います。安全上の上限時間を設け、スクリプト自身が停止した場合は自分で開始したホールドを解除します。

### 4. 診断情報

プレイヤーへの接続状態、停止理由、補正回数、見送った処理、時計の状態などをコンソールから確認できます。

## 導入手順

### 事前に用意するもの

- Chrome / Edge / Firefoxなど、Userscriptマネージャーを利用できるブラウザ
- [Tampermonkey](https://www.tampermonkey.net/) または [Violentmonkey](https://violentmonkey.github.io/)
- ニコニコ動画の通常視聴ページ
- 再生速度も外部から変更したい場合は、動画要素の再生速度を変更できる別の拡張機能

### 手順A：Tampermonkey / Violentmonkeyを準備

1. 利用するブラウザにTampermonkeyまたはViolentmonkeyを導入します。
2. ブラウザの拡張機能一覧で、Userscriptマネージャーが有効になっていることを確認します。
3. マネージャーのダッシュボードを開けることを確認します。

### 手順B：統合版をインストール

1. 次の配布リンクを開きます。

   **[nicovideo-speed-seek-sync.user.js をインストール](https://raw.githubusercontent.com/ButaMonky/nicovideo-speed-seek-sync/main/nicovideo-speed-seek-sync.user.js)**

2. Userscriptマネージャーのインストール確認画面が表示されたら、スクリプト名とバージョンが **1.2.2** であることを確認します。
3. インストールを確定します。
4. マネージャーの一覧に「Nicovideo Speed + Seek Sync (integrated)」が追加されたことを確認します。
5. スクリプトが有効になっていることを確認します。

### 手順C：旧スクリプトを無効化

同じ機能のスクリプトを複数同時に動かすと、プレイヤー内部へのフックが競合します。統合版だけを有効にしてください。

次の旧版が登録されている場合は、**削除する前に無効化**してください。

- `Nicovideo speed limit unlocker`（速度同期の単独版）
- `Nicovideo External Seek Clock Sync`（外部シーク内部時計同期の単独版）
- `Nicovideo Speed + Seek Sync (integrated)` v1.2.0など、古い統合版

旧版を無効にしたら、ニコニコの視聴ページをページ全体で再読み込みします。SPA内の画面遷移だけでは古いフックが残る場合があるため、通常の再読み込みを行ってください。

### 手順D：動作を確認

1. `https://www.nicovideo.jp/watch/動画ID` の通常視聴ページを開きます。
2. ページを再読み込みし、動画プレイヤーの初期化を待ちます。
3. 外部の速度変更ツールを使う場合は、速度を変更して動画とプレイヤー表示が追従するか確認します。
4. 外部操作でシークし、動画・コメント・表示時刻のずれが改善するか確認します。
5. 問題があれば、次の「診断方法」を使って状態を確認します。

最初は短い動画や、再読み込みしても問題のない動画で確認してください。

## 旧版からの移行

### 1.2.0以前から移行する場合

旧統合版1.2.0は `@downloadURL none` で配布されていたため、旧版自身から新しい更新先を見つけられません。次の手順で手動移行してください。

1. 旧統合版1.2.0を無効化します。
2. 速度同期単独版と外部シーク同期単独版も無効化します。
3. [新しい統合版1.2.2](https://raw.githubusercontent.com/ButaMonky/nicovideo-speed-seek-sync/main/nicovideo-speed-seek-sync.user.js) をインストールします。
4. 新版だけを有効にし、視聴ページを再読み込みします。
5. 新版の動作確認後、不要な旧版をマネージャーから削除できます。

### 1.2.1から移行する場合

1.2.1にはGitHubの更新先が設定されています。マネージャーの自動更新が有効なら、通常は更新チェック後に1.2.2へ更新できます。すぐに更新したい場合は、マネージャーのダッシュボードから更新を確認してください。

## 更新方法

配布先は次の1ファイルに統一しています。

`https://raw.githubusercontent.com/ButaMonky/nicovideo-speed-seek-sync/main/nicovideo-speed-seek-sync.user.js`

Userscriptヘッダーの `@downloadURL` と `@updateURL` は、どちらもこのURLを指します。

- 新規インストール：上記のRawリンクを開きます。
- 通常の更新：Tampermonkey / Violentmonkeyの更新チェックに任せます。
- 手動更新：マネージャーのダッシュボードから更新を確認します。
- 更新されない場合：旧版が残っていないか、スクリプトが有効か、自動更新が無効になっていないか確認します。

更新時は `@version` が新しくなっている必要があります。GitHubのREADMEだけが更新されてもUserscript本体の更新にはなりません。

## 診断方法

ニコニコの視聴ページで開発者ツールのConsoleを開き、次を実行します。

### 現在の状態を確認

```js
window.__NICO_EXTERNAL_SEEK_SYNC__?.report()
```

主に次の項目を確認します。

| 項目 | 意味 |
|---|---|
| `version` | 外部シーク同期モジュールのバージョン |
| `phase` | 待機中・接続中・停止などの状態 |
| `reason` | 直近の停止・見送り理由 |
| `bound` | 対象動画への接続状態 |
| `hookActive` | 内部時計の検出フックが有効か |
| `counters` | 検出イベント、補正、見送りなどの回数 |
| `antiJitter` | 一時ホールドの開始・解除・タイムアウト情報 |

### 外部シーク同期部分だけを停止

```js
window.__NICO_EXTERNAL_SEEK_SYNC__?.stop()
```

これは外部シーク同期部分だけを停止します。速度同期も含めて完全に無効化する場合は、Userscriptマネージャーで統合版そのものを無効にし、視聴ページを再読み込みしてください。

## トラブルシューティング

### スクリプトが動いていない

- Userscriptマネージャーと統合版の両方が有効か確認します。
- URLが通常の `/watch/動画ID` ページか確認します。
- 旧単独版・旧統合版が同時に有効になっていないか確認します。
- ページ全体を再読み込みします。
- Consoleに二重フックや既存フックの警告が出ていないか確認します。

### 再生速度が同期しない

- このスクリプト自身には速度変更UIがないことを確認してください。
- 外部速度変更ツールが、実際の動画要素の `playbackRate` を変更しているか確認します。
- 外部ツールが独自の再生実装を使用している場合は、同期できないことがあります。
- 他のUserscriptや拡張機能がプレイヤー内部の `setPlaybackRate` を変更していないか確認します。

### 外部シーク後の表示がずれる

- シーク直後はプレイヤーのネイティブ処理が優先され、補正を見送る場合があります。
- 広告・割込み・コンテンツ切替中は対象外になることがあります。
- Consoleで `window.__NICO_EXTERNAL_SEEK_SYNC__?.report()` を実行し、`phase`、`reason`、`bound` を確認します。
- `reason` が対応外のコンテンツやメディア変更を示す場合、無理に継続させず、ページを再読み込みしてください。

### 診断APIがundefinedになる

- 統合版が有効か確認します。
- 通常のwatchページを開いているか確認します。
- 旧単独版のフックが残っていないか確認します。
- ページを再読み込みしてから再度実行します。

### 更新が表示されない

- 1.2.0以前は手動で新しい配布リンクから再インストールしてください。
- 1.2.1以降はマネージャーの更新チェックを実行してください。
- `@updateURL` と `@downloadURL` がこのREADMEに記載したRaw URLになっているか確認します。

## 対応範囲・制約・安全上の注意

- 対象はトップフレームの通常のニコニコwatchページです。埋め込みプレイヤーや他サイトの動画を対象とする汎用スクリプトではありません。
- ニコニコプレイヤーの非公開・内部実装に依存しています。サイト側の更新で動作しなくなる可能性があります。
- 広告、割込み、ネイティブシーク、外部操作による中断、動画要素や配信ソースの変更、対応外のコンテンツ構成などでは処理を見送るか停止します。
- 速度同期モジュールは `Object.defineProperty` を監視し、`Object.prototype` に `setPlaybackRate` のフックを設定します。外部スクリプトとの互換性に影響する可能性があるため、同種のUserscriptを重ねて有効にしないでください。
- 外部シーク同期モジュールも、既知の内部時計生成を検出するため一時的に `Object.prototype` の `smoothTime` を監視します。ページ終了時や停止時に、自分が設置したフックだけを解除します。
- スクリプトは動画を再シークせず、Cookie・認証情報を読み取ったり、外部サーバーへ送信したり、設定や視聴履歴を保存したりしません。
- `@grant none` / `@sandbox raw` を使用し、ニコニコのページコンテキストで内部状態にアクセスします。信頼できる配布元からのみインストールしてください。

## 検証状況

公開準備時に次の静的検査・自動検査を実施しています。

- JavaScript構文検査（`node --check`）
- 配布URL・バージョン・重複インストール防止マーカーの検査
- GitHub Actionsによる継続的な検査

**これらは本番サイトでの動作保証ではありません。** 現行ニコニコ本番ページ、Tampermonkey / Violentmonkey、外部速度変更ツールを組み合わせた1.2.2の実機回帰試験は未完了です。

不具合があれば、再現手順・ブラウザ・Userscriptマネージャー・診断レポート（認証情報や個人情報を除いたもの）を添えて [Issues](https://github.com/ButaMonky/nicovideo-speed-seek-sync/issues) へ報告してください。

## ライセンスと第三者コード

本リポジトリはMIT Licenseです。

外部シーク同期モジュール、統合処理、診断・計測処理はButaMonkyによるものです。一方、速度同期モジュールには、Eluentyw氏の `Nicovideo speed limit unlocker` v1.1の関数本体が含まれています。元コードのMITライセンス表示と作者への帰属は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) に記載しています。

## 関連リンク

- [リポジトリ](https://github.com/ButaMonky/nicovideo-speed-seek-sync)
- [インストール用Userscript（Raw）](https://raw.githubusercontent.com/ButaMonky/nicovideo-speed-seek-sync/main/nicovideo-speed-seek-sync.user.js)
- [Issues / 不具合報告](https://github.com/ButaMonky/nicovideo-speed-seek-sync/issues)
- [GitHub Actions / CI](https://github.com/ButaMonky/nicovideo-speed-seek-sync/actions)
- [MIT License](LICENSE)
- [第三者コードのライセンス表示](THIRD_PARTY_NOTICES.md)
