---
created: 2026-04-05
updated: 2026-04-05
---

# Active Context

関連ドキュメント:

- [[00_overview]]
- [[01_current_analysis]]
- [[04_roadmap]]
- [[07_decision_log]]
- [[09_open_questions]]
- [[10_work_log]]

## このドキュメントの目的

このファイルは、いま時点で何が true で、次にどこを見るべきかを短く把握するための current snapshot である。  
詳細分析ではなく、今この repo に入ったエージェントが最初に掴むべき current context を集約する。

## Snapshot

- Date: 2026-04-05
- Stage: Early beta foundation in place
- Deployment target: GitHub Pages
- Primary input surface: Discord
- Persistence style: file-based

## いま成立していること

- Discord の `!post` で draft を作成できる
- 同じ Discord message の edit で draft を更新できる
- `!publish <slug>` で published snapshot を作れる
- `!unpublish <slug>` で public snapshot を消せる
- Astro site で published のみ表示できる
- GitHub Pages へ公開できる
- 画像添付も保存と表示ができる
- `GIT_AUTO_COMMIT` / `GIT_AUTO_PUSH` による自動反映が動作する
- `start:bot` で build 済み bot を単体起動できる
- PM2 / systemd 用の常駐運用テンプレートが repo にある
- `!preview`, `!drafts`, `!recent`, `!republish`, `!cleanup-uploads` が使える
- `!status` が git / deploy / attachment 状態を返せる
- GitHub Actions deploy 状態を追跡できる
- public site は beta demo 向けの hero / excerpt / 404 を持つ
- `demo` は git automation を強制無効化してローカル専用で動く
- `post-output.ts` に表示系ロジックを分離し始めた
- public site は article search を持つ
- public site は author name / timestamp を明示し、新しい snapshot では Discord avatar を使える
- applause は localStorage ベースの beta 実装で、グローバル共有カウントではない
- public site の visual direction は warm demo ではなく technical / engineering portfolio 寄り
- public site は article relation graph を持ち、shared tags / same author を元に記事どうしの近さを可視化できる

## いまの構造上の重い痛点

### 1. `content-service.ts` に責務が集中している

現在このファイルに、次が詰め込まれている。

- domain rule
- registry persistence
- markdown generation
- attachment persistence
- git automation 呼び出し
- user-facing message shaping

これは beta 以降の最大ボトルネックである。

### 2. publish と deploy は可視化されたが永続化されていない

bot は publish 後に deploy 状態を返せるようになったが、deploy 情報は問い合わせベースであり operation log としては保存されていない。  
将来的には publish operation をモデル化し、履歴と現在状態を分けて保持したい。

### 3. git automation は構造化されたが application 層に寄っていない

`git add / commit / push` のどこで失敗したかは model 化された。  
ただしその扱いはまだ `content-service.ts` に寄っており、application service と infrastructure adapter の分離は未完了である。

### 4. single-process queue はあるが multi-instance safety はない

process 内の逐次キューは入ったが、複数 instance や外部からの同時書き込みを防ぐ仕組みはない。

### 5. relation graph は heuristic ベースであり、意味的な関連までは見ていない

site の relation graph は現時点では shared tags と same author を元にしている。  
軽量で説明可能な一方、semantic similarity や manual curation はまだ持っていない。

## 直近で優先すべきこと

1. `content-service.ts` の分割開始
2. publish / deploy operation log の導入
3. attachment lifecycle の整理
4. site / bot 間で共有する frontmatter schema の抽出

## 直近でやらなくてよいこと

- DB 導入
- マルチテナント化
- 大規模な admin UI
- GitHub Pages から別公開先への全面移行
- 見た目だけの大規模 redesign
- applause をいきなりグローバル集計化すること

## 作業前に確認すべき前提

- Discord-first であること
- draft と published snapshot の分離を守ること
- docs は living vault であること
- single-tenant 前提を崩さないこと

これらは [[07_decision_log]] にも記録されている。

## 現在のおすすめ参照順

もし次に作業を始めるなら、次を読むのが最短である。

1. [[07_decision_log]]
2. [[04_roadmap]]
3. [[01_current_analysis]]

## この active context を更新すべきタイミング

- 主要 pain point が変わったとき
- 直近優先タスクが変わったとき
- beta 到達条件が更新されたとき
- 実運用方法が変わったとき
