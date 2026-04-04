# Discord Blog PoC

Discord の特定チャンネルから `!post` で下書きを作り、`!publish` で GitHub Pages に載せるまでを最小構成で通す PoC です。DB は使わず、投稿メタデータは `data/posts.json`、draft は `content/drafts/`、公開スナップショットは `apps/site/src/posts/` に保存します。

## アーキテクチャ

- `apps/bot`
  Discord adapter と demo CLI。`!post`, `!publish`, `!unpublish`, `!status`, `!help` を処理します。
- `apps/site`
  Astro の静的ブログ。`apps/site/src/posts/*.md` だけを表示するので draft は公開されません。
- `data/posts.json`
  `messageId -> slug` を中心に、author、status、公開状態、添付パスを保持します。
- `content/drafts/*.md`
  Discord メッセージ編集のたびに更新される最新 draft です。
- `apps/site/public/uploads/YYYY/MM/*`
  添付ファイルの保存先です。Markdown にはこの公開パスを差し込みます。
- `scripts/discord-check.mjs`, `scripts/pages-check.mjs`
  Discord 実機確認と GitHub Pages 事前確認の補助スクリプトです。

## セットアップ

### 前提

- Node.js 20.11 以上
- npm 10 以上

### インストール

`install` は npm の予約ライフサイクルなので custom script にはしていません。標準のコマンドをそのまま使います。

```bash
npm install
```

### 環境変数

`.env.example` をコピーして値を入れてください。

```bash
cp .env.example .env
```

- `DISCORD_TOKEN`: Discord bot token
- `BLOG_CHANNEL_ID`: 監視対象チャンネル
- `PUBLISHER_ROLE_ID`: publish / unpublish を許可する role id
- `GIT_AUTO_COMMIT`: `true` なら draft/publish 更新時に git commit
- `GIT_AUTO_PUSH`: `true` なら commit 後に git push
- `SITE_BASE_URL`: 公開 URL
- `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`: auto commit 用 author

root の `npm run dev`, `npm run demo`, `npm run build`, `npm run test`, `npm run discord:check`, `npm run pages:check` は `.env` を自動で読み込みます。

## 実行方法

### Demo

Discord なしで一連の流れを再現します。

```bash
npm run demo
```

個別にも動かせます。

```bash
npm run demo -- reset
npm run demo -- post demo/fixtures/post-create.json
npm run demo -- edit demo/fixtures/post-edit.json
npm run demo -- publish hello-from-discord
npm run demo -- status hello-from-discord
```

### Discord 実機確認

1 回通しで確認する前に、設定が揃っているかを確認できます。

```bash
npm run discord:check
```

このコマンドは次を行います。

- `.env` の必須値チェック
- Discord Bot token が有効か確認
- 対象チャンネル取得
- publisher role の存在確認
- そのまま貼れる `!post` サンプル出力

その後、別ターミナルで bot と site を起動します。

```bash
npm run dev
```

Discord 上では次の順で確認してください。

1. `npm run discord:check` が出した `!post` サンプルを対象チャンネルに投稿
2. 同じメッセージを編集して本文を変更
3. publisher 権限付きユーザーで `!publish hello-from-discord`
4. `SITE_BASE_URL/posts/hello-from-discord/` を開いて反映確認

### Site / Bot 開発

```bash
npm run dev
```

- Astro site: `http://localhost:4321`
- Discord bot: `DISCORD_TOKEN` があれば接続、なければ idle

### Build / Test

```bash
npm run build
npm run test
```

### GitHub Pages 事前確認

project pages を使う場合は `SITE_BASE_URL` に完全な公開 URL を入れてください。

- user/org pages 例: `https://example.github.io/`
- project pages 例: `https://example.github.io/discord-blog-poc/`

そのうえで、公開パスや upload URL が正しく出るかを確認できます。

```bash
npm run pages:check
```

このコマンドは build を実行し、次を確認します。

- `.github/workflows/pages.yml` がある
- `SITE_BASE_URL` 由来の base path が index に反映される
- 公開記事 HTML に upload URL が正しく埋め込まれる

最後に GitHub の `main` へ push すれば Pages workflow を実行できます。

## Discord コマンド

### 1. draft 作成

```text
!post
title: タイトル
slug: optional
tags: a, b

本文...
```

### 2. 操作コマンド

- `!publish <slug>`
- `!unpublish <slug>`
- `!status <slug>`
- `!help`

## 動作仕様

- 監視対象は `BLOG_CHANNEL_ID` のみ
- `!post` 以外の通常メッセージは無視
- `messageId` ごとに 1 つの slug を紐付け
- 初回保存後の slug は固定
- `!publish` は現在の draft から公開用 Markdown を作成
- publish 後に Discord メッセージを編集しても公開中の記事は自動更新しない
- `!unpublish` しても draft は残る
- 添付は `apps/site/public/uploads/YYYY/MM` にコピーされ、本文末尾に Markdown として追加される
- 添付 URL は `SITE_BASE_URL` を基準に絶対 URL で生成される
- git automation は Git リポジトリかつ `GIT_AUTO_COMMIT=true` のときだけ有効

## ファイルの見方

- draft: `content/drafts/<slug>.md`
- live: `apps/site/src/posts/<slug>.md`
- registry: `data/posts.json`

## GitHub Pages

`.github/workflows/pages.yml` で `main` push 時に `apps/site/dist` を deploy します。project pages で base path が必要な場合は、リポジトリ変数または `.env` の `SITE_BASE_URL` を `https://<user>.github.io/<repo>/` のように設定してください。

## 制限

- シングルテナント前提
- 競合編集や同時 publish のロックはなし
- Discord 添付の削除検知はしていないため、不要になった upload ファイルは残る
- slug の Unicode 変換は最小実装なので、日本語タイトルは自動 slug が `post-<timestamp>` になることがあります
- Astro 側は検索、RSS、OG 生成なし

## 本番化の課題

- publish 承認フローと監査ログ
- 添付ファイルの GC と容量管理
- 投稿履歴の差分表示とロールバック
- slug 変更や複数著者運用の UX
- GitHub Pages 以外の CDN / object storage への upload 分離
- Discord API rate limit と retry の強化
