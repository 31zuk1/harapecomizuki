---
created: 2026-04-05
updated: 2026-04-05
---

# Glossary

関連ドキュメント:

- [[00_overview]]
- [[02_architecture]]
- [[03_data_model]]
- [[07_decision_log]]
- [[08_active_context]]

## このドキュメントの目的

このプロジェクトでは、似ているが意味が違う言葉が多い。  
その曖昧さを減らさないと、人間もエージェントも意図と異なる変更をしやすくなる。

ここでは、実装と設計判断に直結する用語を定義する。

## 基本用語

### Discord Source Message

最初に `!post` として投稿される Discord メッセージ。  
このプロジェクトでは、この message の `messageId` が draft tracking の基準になる。

### Draft

最新の編集内容を反映した、まだ公開確定していない記事状態。  
ファイル上は `content/drafts/<slug>.md` に出力されるが、概念としては file そのものではなく「編集可能な最新状態」を指す。

### Published Snapshot

`!publish <slug>` の時点で切り出される公開用の固定スナップショット。  
draft が更新されても自動では変わらない。

### Live

GitHub Pages 上で実際に公開され、ブラウザから閲覧可能になった状態。  
`published` と `live` は同義ではない。  
local publish 後、git push と Pages deploy を経て初めて live になる。

### Publish

現在の draft から published snapshot を作る操作。  
この操作は少なくとも次の 3 段階を持つ。

- local snapshot write
- git commit / push
- GitHub Pages deploy

### Unpublish

公開スナップショットを外し、public site から記事を消す操作。  
draft は残る。

### Slug

記事 URL とファイル名の基礎になる識別子。  
現在は文字列ベースで採番されているが、概念としては URL-safe な post identifier である。

### Registry

投稿状態を持つ永続データ。  
現状は `data/posts.json` だが、概念としては post aggregate の store を意味する。

### Projection

source of truth から派生して生成される用途別表現。  
この repo では主に次を指す。

- draft markdown projection
- published markdown projection
- Astro public site

### Source of Truth

状態判断の基準となるデータ。  
現状は `data/posts.json` が最も近いが、理想形では post aggregate が source of truth であり、Markdown は projection である。

### Attachment Asset

Discord message に添付されたファイルを保存したもの。  
現状は `apps/site/public/uploads/YYYY/MM/*` に置かれる。

### Deploy State

published snapshot が GitHub Pages 上でどこまで進んでいるかを示す状態。  
少なくとも次を区別する必要がある。

- local only
- pushed
- deploying
- live
- failed

## 状態に関する用語

### `draft`

一度も publish されていないか、公開状態ではない draft を持つ状態。

### `published`

published snapshot が存在する状態。  
ただし live を保証しない。

### `unpublished`

以前 publish された可能性はあるが、現在は公開スナップショットが存在しない状態。

### `hasUnpublishedChanges`

現在の draft が published snapshot より新しいことを示す概念。  
現状は boolean として永続化されているが、理想的には revision 差分から導く派生値である。

## 運用に関する用語

### Bot Runtime

Discord event を待ち受け、コマンドを処理する常駐プロセス。

### Demo Mode

Discord を使わず fixture で同じフローを再現するモード。

### Auto Commit

draft / publish / unpublish 後に `git commit` を自動で打つ挙動。

### Auto Push

auto commit の後に `git push` まで自動で行う挙動。

### Pages Deploy

GitHub Actions を通じて Astro の `dist` を GitHub Pages に反映するプロセス。

## 設計で混同してはいけない言葉

### Draft と File

draft は概念であり、`content/drafts/*.md` はその projection にすぎない。

### Published と Live

published は local state、live は public web state である。

### Registry と Aggregate

registry は storage 形式、aggregate は domain concept である。

### Attachment Path と Public URL

保存先 path と公開 URL は同じではない。  
asset store が path から public URL を発行する。

## この用語集を更新すべきタイミング

- 状態遷移に新しい概念が増えたとき
- source of truth の定義が変わったとき
- publish / deploy の段階が増えたとき
- adapter / core / projection の言葉の使い方を変えたとき

この glossary は、実装と会話の解像度を揃えるための基準である。
