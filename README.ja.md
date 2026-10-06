# Arrow Viewer

ヘッダーの言語切り替えは EN / JA で統一し、切り替え先とヘルプの説明は表示言語に合わせます。バージョンは vMAJOR.MINOR.PATCH 形式で、バッジは「完全ローカル処理」/「Fully local processing」のままです。

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-arrow-viewer/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-arrow-viewer/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-arrow-viewer/)

[English README](README.md)

Apache Arrow IPC File / Streamを外部へアップロードせず、スキーマ・メタデータ・レコードバッチ・辞書・データをブラウザ内だけで確認できる単一HTMLビューアです。

## 🚀 デモ

### [GitHub PagesでArrow Viewerを開く](https://ttomohisa.github.io/htmlapps-arrow-viewer/)

GitHub Pagesから最初のHTMLを読み込んだ後、選択したファイルは端末内で読み込み・処理されます。アプリからファイル内容を外部サーバーへアップロードしません。

[![Arrow Viewerの画面](assets/screenshot.png)](https://ttomohisa.github.io/htmlapps-arrow-viewer/)

## 主な機能

- **Arrow IPC File / Streamを開く** — `.arrow` / `.arrows` / `.ipc` のIPC File / Streamを判別して読み込みます。
- **SchemaとMetadataを確認** — Schema Tree / Raw JSON、ファイルMetadata、Metadata Version、Endianness、Footer / Header情報を確認できます。
- **Record BatchとDictionaryを確認** — バッチ行数、オフセット、Metadata / Bodyサイズ、Dictionary情報を確認できます。
- **現在ページに必要なBatchだけ読む** — ファイル全体を一度に表へ展開せず、現在ページに必要なRecord Batchだけ読み込みます。
- **一般的なArrow値を確認** — Primitive、Timestamp、List / Struct、Dictionary Encodingされた値を確認できます。
- **現在ページを確認・出力** — Table / Record、表示列、現在ページソート、Cell Inspector、CSVコピー／保存に対応します。
- **現在ページの並べ替えを操作** — キーボード対応の列見出しで昇順・降順・元の順序を切り替えます。Table / Recordのどちらでも状態確認と解除ができ、並べ替え中の列を隠しても操作できます。
- **ファイルごとに状態を分離** — 複数ファイルを開いても、1ファイルのエラーやSchemaが別タブへ残りません。

## すぐに使う

### Webで使う

[デモを開く](https://ttomohisa.github.io/htmlapps-arrow-viewer/)だけで利用できます。インストールやアカウント登録は不要です。

### 単一HTMLをダウンロードして使う

1. リポジトリから [`dist/index.html`](https://github.com/ttomohisa/htmlapps-arrow-viewer/blob/main/dist/index.html) をダウンロードします。
2. 最新のChromiumベースブラウザ、Firefox、Safariで直接開きます。

`dist/index.self-extract.html` も収録しています。こちらはブラウザ内で可読版HTMLを復元してから起動するSelf-extract版です。

### ローカルでビルドする

1. このリポジトリをダウンロードまたはクローンします。
2. Windowsで `build-standalone.bat` をダブルクリックします。
3. `dist/index.html` と `dist/index.self-extract.html` が生成され、単一HTMLとして検証されます。
4. 生成されたHTMLを端末上で直接開きます。

Python、Node.js、ローカルWebサーバーは不要です。Windows PowerShellと標準の `tar.exe` を使用します。

## 使い方

1. `.arrow` / `.arrows` / `.ipc` を1つ以上追加します。
2. 判定された形式、行数、Record Batch、Dictionary、Metadataを確認します。
3. SchemaをTree / Rawで確認します。
4. ページ操作でレコードを確認します。現在ページに必要なRecord Batchだけ読み込みます。
5. Table / Recordを切り替え、ネスト値はCell Inspectorで確認します。Tableの列見出しで並べ替えを切り替え、どちらの表示でも「並べ替えを解除」で元の順序へ戻せます。ページや1ページの行数を変更すると並べ替えは解除されます。
6. 現在ページの読み込み完了後にCSVをコピーまたは保存します。読み込み中や失敗時は出力できません。正常に読み込んだ0行のページはヘッダーを出力します。

## GitHub Pagesで公開する

このリポジトリには、単一HTMLをビルドして `dist/` をGitHub Pagesへ自動公開するワークフローが含まれています。

1. リポジトリ名を `htmlapps-arrow-viewer` としてGitHubへプッシュします。
2. **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。
3. `main` ブランチへプッシュするか、Actions画面から **Deploy standalone app to GitHub Pages** を手動実行します。
4. ビルド成功後、`https://ttomohisa.github.io/htmlapps-arrow-viewer/` で公開されます。

`main` へのプッシュ時にはリポジトリ検査、単一HTMLの再生成、検証を行い、GitHub Pagesが有効な場合に確認済みの `dist/` を公開します。

## 開発とビルド

```text
.
├─ src/index.template.html       # アプリ本体のテンプレート
├─ app.config.json               # アプリ情報・バージョン・ビルド設定
├─ dependencies.json             # 実行時依存の宣言
├─ dependencies.lock.json        # 依存ロック情報
├─ build-standalone.bat          # Windows用ビルド入口
├─ build-standalone.ps1          # 単一HTMLビルダー
├─ scripts/check-repository.ps1  # リポジトリ／ビルド検査
├─ dist/index.html               # 可読版の単一HTML
├─ dist/index.self-extract.html  # Self-extract版の単一HTML
└─ .github/workflows/
   ├─ build-standalone.yml       # ビルド検証
   └─ deploy-pages.yml           # GitHub Pages自動公開
```

### ビルドと検査

```bat
build-standalone.bat
```

リポジトリ検査だけを直接実行する場合：

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-repository.ps1
```

ビルド／検査では、依存ロック、未置換プレースホルダー、実行時通信の制約、単一HTML生成、Self-extract版の生成・復元検証などを確認します。

## プライバシーと通信防止

生成された単一HTMLには `connect-src 'none'` を含むContent Security Policyがあります。選択したファイルはブラウザのFile APIで読み込まれ、端末内に留まります。アプリはAnalytics、Telemetry、外部API、実行時CDNを必要としません。

GitHub Pages版では最初のHTML配信だけ通信が発生します。その後、選択したファイルはアプリ内でローカル処理されます。ネットワークを完全に切って使う場合は `dist/index.html` を直接開いてください。

Apache ArrowはApache Software Foundationのプロジェクトです。本ツールは公開されているApache Arrow IPC仕様の一部を実装する独立したツールで、Apache Software Foundationの公式ツールではありません。

Decimal列は丸めず正確な数値順に並べ替えます。表示値とCSVの小数表記は変えません。

## 制限事項

- 閲覧専用です。Arrow IPCファイルを編集・再生成する機能はありません。
- Featherは正式対応形式として案内していません。
- LZ4 / ZSTDで圧縮されたIPC Body Bufferはv1.0.1では未対応として扱います。
- CSV保存は正常に読み込んだ現在ページが対象で、表示列とソート順を保持します。ファイル全体の出力には対応しません。
- 並べ替えでは、省略表示の先にあるバイナリも含めて完全な値を比較します。nullは昇順・降順とも末尾になり、同じ値は元の順序を保ちます。追加のバッチ読み込みは発生しません。
- CSV、セルの内容／コピー、展開したレコードでは、ネスト内も含めたバイナリ値の全バイトを空白区切りの16進数で表示します。表やレコード見出しのプレビューは省略表示のままです。
- スキーマのコピーはヘッダー解析後に利用でき、行データの読み込み成功とは独立しています。
- SQL / Query EngineではなくViewerです。

## 依存関係

Arrow Viewer v1.0.1 は、実行時のサードパーティJavaScriptライブラリを同梱していません。

形式・プロジェクトに関する補足は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を確認してください。

## コントリビューション

バグ報告や機能提案はGitHub Issuesからお願いします。開発への参加方法は [CONTRIBUTING.md](CONTRIBUTING.md) を確認してください。

## ライセンス

Copyright © 2026 ttomohisa

このプロジェクトは [MIT License](LICENSE) で公開されています。

リポジトリ検査にはNode.js 22以降が必要です。ソース、通常HTML、ルートの配布HTML、自己展開HTMLに同じ回帰テストを実行します。合成バッチと簡易DOMによる検査であり、ブラウザーやIPCファイル全体の読み込み検証の代わりではありません。通常ビルドは `arrow-viewer.html` も更新し、`-OutputPath` 指定時は変更しません。
