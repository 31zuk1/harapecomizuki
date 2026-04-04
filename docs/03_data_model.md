---
created: 2026-04-05
updated: 2026-04-05
---

# Data Model

関連ドキュメント:

- [[00_overview]]
- [[01_current_analysis]]
- [[02_architecture]]
- [[04_roadmap]]

このドキュメントは、現在の JSON 構造の写経ではなく、このプロジェクトの状態管理を理解し続けるための data knowledge base である。  
source of truth や派生値の扱いが変わったら、必ず更新すること。

## 1. 現在のデータモデル

現在の source of truth は [`data/posts.json`](/Users/haramizuki/Project/DiscordCMS/data/posts.json) であり、概ね以下の形を持つ。

```ts
interface RegistryFile {
  posts: Record<string, RegistryPost>; // key = messageId
}

interface RegistryPost {
  messageId: string;
  channelId: string;
  slug: string;
  title: string;
  tags: string[];
  body: string;
  authorId: string;
  authorName: string;
  status: 'draft' | 'published' | 'unpublished';
  hasUnpublishedChanges: boolean;
  attachments: StoredAttachment[];
  draftFilePath: string;
  publishedFilePath: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}
```

この構造は PoC としては十分だが、実運用に必要な概念が不足している。

不足しているもの:

- post aggregate の revision 概念
- publish operation と deploy operation の区別
- git push 結果
- deploy 状態
- 添付ファイルの lifecycle
- audit log

## 2. 理想のデータモデル

理想形では、1 つの `Post` aggregate を中心に、用途別 projection を派生させる。

## 3. 中核エンティティ

### 3.1 Post

```ts
type PostStatus = 'draft' | 'published' | 'unpublished' | 'archived';

interface Post {
  id: string;                    // internal id (UUID or stable derived id)
  source: PostSource;
  slug: Slug;
  title: string;
  body: string;
  tags: string[];
  author: AuthorRef;
  status: PostStatus;
  revision: number;
  publishedRevision: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  attachments: AttachmentRef[];
}
```

設計意図:

- `messageId` は source identifier として扱い、内部主キーと分離する
- `revision` と `publishedRevision` を持つことで `hasUnpublishedChanges` を派生値にできる

### 3.2 PostSource

```ts
interface PostSource {
  kind: 'discord';
  channelId: string;
  messageId: string;
  guildId?: string | null;
}
```

設計意図:

- 入力元をモデル化し、将来 CLI / Web UI / Email などに拡張可能にする

### 3.3 AttachmentRef

```ts
interface AttachmentRef {
  id: string;
  originalName: string;
  mimeType: string | null;
  storageKey: string;            // uploads/2026/04/...
  publicUrl: string;
  checksum?: string | null;
  size?: number | null;
}
```

設計意図:

- path を string として埋めるだけでなく、将来 asset store 差し替えに耐える

### 3.4 PublishOperation

```ts
type PublishOperationStatus =
  | 'pending'
  | 'snapshot_written'
  | 'git_committed'
  | 'git_pushed'
  | 'deploying'
  | 'live'
  | 'failed';

interface PublishOperation {
  id: string;
  postId: string;
  slug: string;
  targetRevision: number;
  action: 'publish' | 'unpublish' | 'republish';
  status: PublishOperationStatus;
  commitSha: string | null;
  workflowRunId: string | null;
  workflowRunUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
```

設計意図:

- `publish` と `deploy` を 1 回の操作として追跡できる
- Discord reply / status コマンドの元データに使える

### 3.5 DraftProjection

```ts
interface DraftProjection {
  slug: string;
  revision: number;
  markdownPath: string;
  renderedAt: string;
}
```

### 3.6 PublishedProjection

```ts
interface PublishedProjection {
  slug: string;
  revision: number;
  markdownPath: string;
  renderedAt: string;
  publicUrl: string;
}
```

projection は source of truth ではなく、用途別に生成された派生物である。

## 4. 派生値

現在 `hasUnpublishedChanges` は永続化されているが、理想形では派生値として扱う方が自然である。

```ts
function hasUnpublishedChanges(post: Post): boolean {
  return post.publishedRevision === null || post.revision > post.publishedRevision;
}
```

設計意図:

- 二重管理による不整合を減らす
- publish 直後 / edit 直後の state を単純化する

## 5. 推奨 JSON スキーマ構成

DB を導入しない前提でも、単一 `posts.json` に全て押し込む必要はない。

### option A: 単一ファイル

```json
{
  "posts": {},
  "operations": {}
}
```

利点:

- 実装が単純

欠点:

- file が大きくなる
- 競合時に壊れやすい

### option B: 分割ファイル

```text
runtime/
  posts/
    <post-id>.json
  operations/
    <operation-id>.json
  drafts/
    <slug>.md
  published/
    <slug>.md
```

利点:

- 部分更新しやすい
- operation log を独立管理できる

欠点:

- file 数が増える

このプロジェクトでは beta でも option B の方が合理的である。  
理由は、同時編集・連続 publish・障害時調査で 1 投稿単位の state を追いやすいからである。

## 6. フロントマターの理想スキーマ

現在は bot 側で frontmatter を文字列生成している。理想形では frontmatter schema を `packages/contracts` に置き、bot と site で共有する。

```ts
interface PublishedPostFrontmatter {
  title: string;
  tags: string[];
  authorName: string;
  authorId: string;
  sourceKind: 'discord';
  sourceMessageId: string;
  sourceChannelId: string;
  revision: number;
  publishedRevision: number;
  publishedAt: string;
  draftUpdatedAt: string;
  attachments: string[];
}
```

追加意図:

- `status` は published snapshot では基本的に常に published なので不要
- `revision`, `publishedRevision` を持たせると troubleshooting がしやすい

## 7. Command / Result モデル

現在は Discord message 相当の `IncomingMessage` が application 入力に近い。理想形では use case ごとに command を分ける。

### 入力コマンド

```ts
interface CreateDraftCommand {
  source: PostSource;
  actor: ActorRef;
  title: string;
  requestedSlug?: string;
  tags: string[];
  body: string;
  attachments: NewAttachmentInput[];
  occurredAt: string;
}

interface PublishPostCommand {
  slug: string;
  actor: ActorRef;
  occurredAt: string;
}
```

### 結果モデル

```ts
type DraftResult =
  | { kind: 'draft_created'; slug: string; revision: number }
  | { kind: 'draft_updated'; slug: string; revision: number; publishedRevision: number | null };

type PublishResult =
  | { kind: 'published_locally'; slug: string; revision: number }
  | { kind: 'git_pushed'; slug: string; revision: number; commitSha: string }
  | { kind: 'deploying'; slug: string; revision: number; workflowRunUrl?: string }
  | { kind: 'failed'; reason: string; detail: string };
```

設計意図:

- adapter が人間向け文言を組み立てやすい
- API / CLI / Discord で表現を変えられる

## 8. Config モデル

現在の `ResolvedConfig` は domain setting と infrastructure path を同時に持つ。理想形では分離する。

```ts
interface RuntimeSettings {
  blogChannelId: string;
  publisherRoleId?: string;
  siteBaseUrl: string;
}

interface StorageSettings {
  repoRoot: string;
  runtimeDir: string;
  draftsDir: string;
  publishedDir: string;
  uploadsDir: string;
}

interface GitSettings {
  autoCommit: boolean;
  autoPush: boolean;
  authorName?: string;
  authorEmail?: string;
}

interface DeploymentSettings {
  githubRepo?: string;
  githubToken?: string;
  workflowName?: string;
}
```

## 9. 移行時の互換方針

理想モデルへ一気に切り替えると互換性が壊れるため、beta への移行は段階的に行うべきである。

推奨方針:

1. 既存 `posts.json` は当面読み続ける
2. 新しい internal model に map する adapter を作る
3. `hasUnpublishedChanges` は旧データでは読み込み、新規保存では派生計算に移行
4. operation log は新規追加のみで後方互換を保つ

具体的な移行順は [[04_roadmap]] にまとめる。
