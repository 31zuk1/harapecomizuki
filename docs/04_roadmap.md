---
created: 2026-04-05
updated: 2026-04-05
---

# Refactoring Roadmap

関連ドキュメント:

- [[00_overview]]
- [[01_current_analysis]]
- [[02_architecture]]
- [[03_data_model]]

この roadmap は一度決めたら終わりの計画書ではなく、プロジェクトの進行に合わせて更新される living roadmap である。  
優先順位、前提条件、移行戦略が変わったら、その変更をここに反映すること。

## 1. 進め方の原則

このリファクタリングは、「全部書き直す」のではなく「PoC を止めずに、理想構造へ段階的に寄せる」方針で進める。

原則:

- main を壊さない
- user-visible behavior を維持しながら内部構造を差し替える
- state format の変更は adapter を噛ませて移行する
- 各フェーズで build / test / demo / 実機確認が通ることを完了条件にする

## 2. 優先順位付きタスク分解

### 現在の進捗メモ

- Task 1-1 完了: `start:bot`, `preview:site`, `.env.production.example` を追加済み
- Task 1-2 完了: PM2 / systemd テンプレートを追加済み
- Task 2-1 完了: `git.ts` は `GitAutomationResult` を返す
- Task 2-2 部分完了: publish / unpublish / draft reply で git 結果を返す
- Task 4-2 部分完了: GitHub Actions の状態確認は追加済みだが、operation log は未導入
- Task 5-1 完了: `!drafts`, `!recent`, `!republish`, `!preview`, `!cleanup-uploads` を追加済み
- Task 6-1 完了: single-process queue を導入済み
- Task 3-1 着手済み: 表示系 / Markdown 系の純粋関数を `post-output.ts` へ分離開始
- Task 7-2 完了: excerpt / 404 page / beta 向け UI 改善を実施済み

### Priority 0: 現状安定化

#### Task 0-1: 直近の bot 修正を整理して main を安定化

目的:

- 再起動後の message edit tracking 修正
- publish 文言の改善

影響範囲:

- `apps/bot/src/discord-bot.ts`
- `apps/bot/src/content-service.ts`

完了条件:

- `npm run test`
- `npm run build`
- 実機で既存 `!post` の edit が反映される

### Priority 1: 常駐運用の整備

#### Task 1-1: production startup の追加

目的:

- `npm run dev` 依存を外し、bot 単体を常駐できるようにする

実装:

- root `package.json` に `start:bot`
- bot build 後 `node apps/bot/dist/index.js` を起動

影響範囲:

- `package.json`
- `README.md`

状態:

- 完了済み

#### Task 1-2: PM2 / systemd テンプレート追加

目的:

- 実際の運用方法を repo に同梱する

実装:

- `deploy/pm2.ecosystem.config.cjs`
- `deploy/discord-blog-bot.service`

影響範囲:

- 新規 `deploy/`
- `README.md`

状態:

- 完了済み

### Priority 2: git automation を構造化

#### Task 2-1: `git.ts` を結果返却型へ変更

目的:

- silent failure をやめる
- 失敗箇所を user-facing status に伝える

実装:

- `maybeRunGitAutomation(): GitAutomationResult`
- stderr / stdout capture
- status code 分岐

影響範囲:

- `apps/bot/src/git.ts`
- `apps/bot/src/types.ts`
- `apps/bot/src/content-service.ts`

状態:

- 完了済み

#### Task 2-2: git failure を Discord reply に反映

目的:

- publish 直後に「なぜ公開されないか」が分かるようにする

実装:

- add / commit / push の段階別 message
- `status` に last git result を追加

状態:

- 部分完了
- reply 側の message shaping は入った
- 「last git result の永続化」は未実装

### Priority 3: application core の分離開始

#### Task 3-1: `content-service.ts` から Markdown rendering を分離

目的:

- projection logic を独立させる

実装:

- `renderDraftMarkdown(post)`
- `renderPublishedMarkdown(post)`

影響範囲:

- 新規 `apps/bot/src/markdown.ts`
- `apps/bot/src/content-service.ts`

状態:

- 着手済み
- 現在は `post-output.ts` に表示系 / Markdown 系の純粋関数を切り出している
- まだ domain/application/infrastructure の明確な分離までは到達していない

#### Task 3-2: attachment persistence を分離

目的:

- content workflow と media IO の責務分離

実装:

- 新規 `apps/bot/src/asset-store.ts`
- `persistAttachment()` の移動

#### Task 3-3: repository interface を導入

目的:

- domain / application を JSON 実装から分離

実装:

- `PostRepository` interface
- `JsonFilePostRepository` 実装

影響範囲:

- `apps/bot/src/content-service.ts`
- 新規 `apps/bot/src/post-repository.ts`

### Priority 4: publish と deploy の分離

#### Task 4-1: publish operation log を導入

目的:

- local publish と deploy の段階を区別する

実装:

- `runtime/operations/*.json` または `data/operations.json`
- `PublishOperation` model

#### Task 4-2: GitHub Actions 状態確認

目的:

- `!publish` 後の deploy 状態を Discord 上で確認可能にする

実装:

- GitHub REST API client
- latest workflow run lookup
- `!status` に deploy state を追加

影響範囲:

- 新規 `apps/bot/src/github-actions.ts`
- `apps/bot/src/config.ts`
- `apps/bot/src/content-service.ts`

状態:

- 部分完了
- GitHub API lookup は実装済み
- operation log と deploy 履歴は未実装

### Priority 5: command surface の改善

#### Task 5-1: `!drafts`, `!recent`, `!republish`

目的:

- Discord 上での運用性向上

状態:

- 完了済み

#### Task 5-2: `!post` parse error の改善

目的:

- スマホからの入力ミスを self-healing しやすくする

実装:

- validation error code を返す
- Discord adapter で message 変換

### Priority 6: state transition と queue 制御

#### Task 6-1: single-process queue 導入

目的:

- edit / publish race を抑止

実装:

- process 内 queue
- slug or messageId 単位 lock

状態:

- 最小版として完了済み
- 現在は process-wide queue で逐次処理

#### Task 6-2: revision model 導入

目的:

- `hasUnpublishedChanges` を派生値へ移行

### Priority 7: site 側の改善

#### Task 7-1: frontmatter schema 共有

目的:

- bot と site の整合性強化

実装:

- `packages/contracts/frontmatter.ts`
- site build 時 validation

#### Task 7-2: UX 改善

目的:

- beta としての見え方改善

実装:

- excerpt
- 404 page
- attachment rendering enhancement

状態:

- 完了済み

### Priority 8: test 拡張

#### Task 8-1: git automation tests
#### Task 8-2: deploy status mapping tests
#### Task 8-3: image lifecycle tests
#### Task 8-4: queue / race tests

## 3. 段階的なリファクタリング手順

### Step 1: 外から見える挙動を固定する

先に test を増やし、「壊してはいけない現在の仕様」を固定する。

最低限固定するもの:

- `!post` -> draft 作成
- edit -> draft 更新
- publish 後 edit -> published unchanged
- unpublish -> live 消える
- image attach -> markdown へ反映

### Step 2: service 内分割

`content-service.ts` を以下の責務に分割する。

- command result shaping
- post repository access
- markdown projection generation
- asset store
- git publisher

この段階では public API はまだ保つ。

### Step 3: application use case を導入

新規 use case を作り、command-service は use case 呼び出しだけにする。

例:

- `CreateDraftFromPostMessageUseCase`
- `PublishPostUseCase`

### Step 4: data model 移行

旧 `RegistryPost` を読み、新 model に map する adapter を入れる。  
書き込みは新 model に寄せる。

### Step 5: deploy state 連携

GitHub integration を use case の外部 port として導入する。

### Step 6: production startup と運用資材

最後に常駐運用・監視・ログ整備を加える。

## 4. 破壊的変更と移行戦略

### 4.1 `posts.json` フォーマット変更

破壊度:

- 中

戦略:

- 旧 `posts.json` loader を残す
- 起動時 migration ではなく read adapter で吸収
- 安定後に migration command を提供

### 4.2 `apps/site/src/posts` の取り扱い変更

破壊度:

- 中

現状:

- bot が site source tree を直接書いている

理想:

- bot runtime projection と site build input を分離

戦略:

- 一旦 `runtime/published` を新設
- build script で `apps/site/src/posts` へ materialize
- 安定後に site の読込先を切り替える

### 4.3 `hasUnpublishedChanges` の永続化廃止

破壊度:

- 低

戦略:

- 旧データは読み込む
- 新規保存では `revision` ベースに移行
- site / status は派生関数を使う

### 4.4 Discord reply 文言の構造化

破壊度:

- 低

戦略:

- 内部では structured result に移行
- adapter で互換 message を当面維持

## 5. フェーズごとの完了条件

### Phase A: Operational Beta

条件:

- bot を常駐起動できる
- auto commit / push の成功失敗が見える
- publish 直後の一時 404 が説明可能

### Phase B: Structural Beta

条件:

- core logic が infrastructure から分離
- repository / asset / git / deploy の port がある
- tests が use case 単位で書ける

### Phase C: Product Beta

条件:

- Discord だけで日常運用しやすい
- 状態確認コマンドが十分
- attach / publish / unpublish / republish が安定

## 6. 最初に着手すべき具体タスク

今すぐ着手するなら順番はこれが良い。

1. `git.ts` の結果返却化
2. `content-service.ts` から Git 結果を user-facing message に反映
3. `start:bot` と PM2 / systemd テンプレート追加
4. markdown rendering の分離
5. post repository interface の導入

理由:

- 利用者が最初に困るのは構造美ではなく「動いているか分からない」ことだから
- その次にメンテナが困るのは `content-service.ts` への責務集中だから

## 7. 最終的な移行イメージ

移行後は、現状の一枚岩構造から以下へ変わる。

- adapter: Discord / Demo
- application: use cases
- domain: post workflow policy
- infrastructure: file/json, git, GitHub, local uploads
- site: published projection renderer

この形にできれば、PoC から beta への進化だけでなく、その先の production hardening にも自然につながる。
