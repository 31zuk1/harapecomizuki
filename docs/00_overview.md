---
created: 2026-04-05
updated: 2026-04-05
---

# Discord Blog PoC: Design Overview

この vault は、このプロジェクト全体で継続的に使い回す開発記録兼ナレッジベースである。

ここに置く情報は、一時的な設計メモではなく、以下を兼ねることを意図している。

- 人間が後から見返すための判断履歴
- エージェントが迷ったときに参照する羅針盤
- 現状把握と将来設計を接続する長期的な設計資産

したがって、この vault は「PoC をベータ版へ進化させるためだけの使い捨てドキュメント群」ではない。  今後もプロジェクトの進行に合わせて更新し続ける前提の、長寿命な project memory である。

関連ドキュメント:

- [[01_current_analysis]]
- [[02_architecture]]
- [[03_data_model]]
- [[04_roadmap]]
- [[05_vault_map]]
- [[06_glossary]]
- [[07_decision_log]]
- [[08_active_context]]
- [[09_open_questions]]
- [[10_work_log]]
- [[99_vault_rules]]

## このドキュメントの目的

このプロジェクトはすでに最低限動作しているが、現状は「PoC を成立させるために最短で組まれた構造」であり、常駐運用・複数ユースケース・障害時の可観測性・将来拡張を前提とした設計にはまだ届いていない。

本ドキュメント群では、以下を一貫した形で整理する。

- 現在の実装がどのような構造で動いているか
- どこに責務の混在や将来のボトルネックがあるか
- ゼロから設計し直すなら、どのようなアーキテクチャが合理的か
- その理想形にどのような順序で移行すべきか

加えて、この vault は将来の変更によってこの内容が古くなったとき、差分を吸収しながら更新されることを前提にしている。  
つまり本書群は「現在の正しさを閉じ込める資料」ではなく、「変化の中でも参照可能な知識基盤」である。

## スコープ

分析対象は、repo root 以下の以下の構成である。

- `apps/bot`
  Discord message を受け取り、draft / publish / unpublish / status を処理する Node.js + TypeScript アプリケーション
- `apps/site`
  Astro ベースの静的公開サイト
- `content/drafts`
  下書き Markdown
- `data/posts.json`
  投稿メタデータの JSON registry
- `scripts/*`
  build / dev / test / demo / check 用の補助スクリプト
- `.github/workflows/pages.yml`
  GitHub Pages へのデプロイ workflow

## 現在のシステムが実現していること

現状の PoC は、以下のエンドツーエンドフローを実現している。

1. Discord の特定チャンネルで `!post` を投稿
2. Bot がメッセージ本文を parse
3. `data/posts.json` にメタデータを書き込み
4. `content/drafts/<slug>.md` に下書き Markdown を生成
5. 必要に応じて `apps/site/public/uploads/YYYY/MM/*` に添付を保存
6. `!publish <slug>` で `apps/site/src/posts/<slug>.md` に公開スナップショットを生成
7. GitHub Pages workflow により `apps/site/dist` を公開

重要な仕様として、publish 後に元の Discord メッセージを編集しても公開記事は自動更新されず、draft のみが更新される。

## 現在の構造の総評

PoC としては成功しているが、構造上は以下の性格が強い。

- 単一プロセス前提
- 単一 JSON registry 前提
- file system を実質的な database / queue / snapshot store として兼用
- bot 側の service に domain, persistence, attachment IO, git automation が集中
- GitHub Pages の deploy 状態を bot が把握していない

つまり、「とにかく動く」ことには向くが、「長く運用する」「障害時に復旧しやすい」「機能追加しても壊れにくい」構造にはまだなっていない。

## 目指すゴール

このプロジェクトが次の段階で目指すべき状態は、以下のように定義する。

- bot は常駐運用できる
- publish の結果が local write / git push / Pages deploy のどこまで進んだか分かる
- 投稿、編集、公開、非公開、添付、権限、失敗ケースが明示的に扱われる
- domain rule と infrastructure detail が分離され、テストが書きやすい
- 将来、Discord 以外の入力チャネルや GitHub Pages 以外の配信先にも拡張可能

そのため、理想設計は「Discord bot を中心に置いた単体アプリ」ではなく、「投稿ワークフローを提供するアプリケーション core」と「Discord / file system / GitHub などの adapter」に分割して考える必要がある。

詳細は以下を参照。

- 現状の実装分析: [[01_current_analysis]]
- 理想アーキテクチャ: [[02_architecture]]
- データモデル: [[03_data_model]]
- リファクタリング計画: [[04_roadmap]]
- vault の読み方: [[05_vault_map]]
- 用語定義: [[06_glossary]]
- 決定済み事項: [[07_decision_log]]
- 現在地: [[08_active_context]]
- 未決事項: [[09_open_questions]]
- 作業履歴: [[10_work_log]]
- 運用ルール: [[99_vault_rules]]

## この vault の使い方

この vault は読むだけでなく、保守されることに価値がある。

更新指針:

- 事実が変わったら現状分析を更新する
- 設計判断が変わったら理想構成を更新する
- データの source of truth が変わったら data model を更新する
- 実装順や優先順位が変わったら roadmap を更新する

## ドキュメントの読み順

初見の読者には次の順を推奨する。

1. [[05_vault_map]]
2. [[08_active_context]]
3. [[07_decision_log]]
4. [[01_current_analysis]]
5. [[02_architecture]]
6. [[03_data_model]]
7. [[04_roadmap]]

## ひとことで言うと

現状の repo は「Discord 投稿を Markdown 記事に変換する一枚岩の PoC」である。  
ベータ版に進めるには、「投稿ワークフローの core」と「Discord / FS / Git / Pages の接続部分」を分離した、責務の明確なアーキテクチャへ再編する必要がある。
