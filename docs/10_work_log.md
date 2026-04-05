---
created: 2026-04-05
updated: 2026-04-05
---

# Work Log

関連ドキュメント:

- [[00_overview]]
- [[08_active_context]]
- [[07_decision_log]]
- [[99_vault_rules]]

## このドキュメントの目的

このファイルは、何をいつやったかを後から追えるようにするための軽量な作業記録である。  
git log はコード差分を見るには十分だが、なぜその変更をしたかや、どこまで確認したかは必ずしも残らない。  
ここでは「後から見返して文脈を取り戻せる」ことを優先する。

## 2026-04-05

### Vault 初期整備

- `docs/00_overview.md` から `docs/04_roadmap.md` までの設計ドキュメントを新規作成
- current analysis, target architecture, data model, roadmap を整理
- Obsidian wikilink で相互接続

### Vault 運用方針の明文化

- `docs/` を使い捨て資料ではなく長期運用する vault として再定義
- 各 Markdown に `created`, `updated` metadata を付与
- `AGENTS.md` に vault discipline を追加

### Codex 向けの vault 改善

- [[05_vault_map]] を追加して読み順を整理
- [[06_glossary]] を追加して用語の曖昧さを削減
- [[07_decision_log]] を追加して決定済み事項を固定
- [[08_active_context]] を追加して current snapshot を集約
- [[09_open_questions]] を追加して未決事項を分離
- [[99_vault_rules]] を追加して更新ルールを明文化

### 実装面の進展

- GitHub Pages で site を公開できる状態まで到達
- image upload を含む Discord -> Pages の流れを実機で確認
- bot の `messageUpdate` が再起動後の既存 message edit でも動くように修正
- publish message に deploy latency の注意文言を反映
- `GIT_AUTO_COMMIT` / `GIT_AUTO_PUSH` の自動化を有効化

### Beta foundation 実装

- root に `start:bot` と `preview:site` を追加し、`npm run dev` 依存を外す導線を整備
- `deploy/pm2.ecosystem.config.cjs` と `deploy/discord-blog-bot.service` を追加して常駐運用の雛形を同梱
- `.env.production.example` を追加し、GitHub deploy tracking 系の env を整理
- `git.ts` を結果返却型へ拡張し、commit / push / failure を構造化
- upstream 未設定 branch でも auto push できるように改善
- `github-actions.ts` を追加し、GitHub Pages workflow の状態確認を bot から可能にした
- `command-service.ts` に single-process queue を導入し、mutating command を逐次処理に変更
- `!preview`, `!drafts`, `!recent`, `!republish`, `!cleanup-uploads` を追加
- `!status` に git / deploy / attachment summary を追加
- 添付の MIME / サイズ制限を導入し、cleanup command を追加
- bot test を拡張し、git auto commit/push と user-facing failure 表示を固定
- Astro site を beta demo 向けに再設計し、excerpt / workflow hero / 404 page を追加

### 仕上げ検証と追加修正

- `npm run test`, `npm run build`, `npm run pages:check`, `npm run demo` を順番に再検証
- `npm run start:bot` と `npm run preview:site` が常駐起動できることを確認
- 検証中に `demo` が実環境の `GIT_AUTO_COMMIT` / `GIT_AUTO_PUSH` を拾ってしまう問題を発見
- `demo` は常にローカル専用になるよう修正し、本番 repo へ自動 push しない挙動に変更
- demo 検証後に tracked content/data を demo 実行前の基準 state まで戻し、コード差分と検証副作用を分離
- fix 前の demo 実行で `main` に content-only commit が入ったため、現在の working tree は次回の意図的な commit/push で content を戻せる状態にしてある
- `content-service.ts` の肥大化対策として、Markdown / deploy / git summary の純粋関数を `post-output.ts` へ分離

### Site UX 追加改善

- site に article search を追加し、title / tags / author / excerpt をブラウザ内で横断検索可能にした
- article / card に author identity を追加し、名前と日時を明示した
- 新しい publish からは Discord avatar URL を frontmatter に保持できるようにした
- 既存 snapshot には avatar 情報がないため、site では fallback initials で表示する設計にした
- article ページに拍手ボタンと拍手数表示を追加した
- 拍手数は GitHub Pages 上で完結させるため localStorage ベースとし、beta 制約として明示した
- spacing / font variable / meta layout を整理し、一覧と記事詳細の余白バランスを揃えた

### Visual direction の再調整

- site の雰囲気を warm demo から、blue-gray ベースの technical / engineering portfolio 寄りに変更
- monospace labels, crisper borders, grid-like background を使って「運用系プロダクト」らしい見え方に寄せた
- 情報設計は維持したまま、copy と visual tone を professional / precise 寄りに調整した

### Article relation graph の追加

- site の home に relation graph section を追加し、公開済み記事を shared tags / same author の重みで可視化した
- 記事詳細ページにも focus graph を追加し、いま読んでいる記事を中心に近い投稿へ遷移しやすくした
- relation logic は `apps/site/src/lib/posts.ts` に寄せ、component から切り離して再利用可能にした
- graph inspector には selected node, strongest links, relation reasons を表示し、なぜつながっているかを説明可能にした
- semantic similarity ではなく説明しやすい heuristic を採用し、次の改善余地として vault に残した

### いま残っている次の課題

- `content-service.ts` の分割
- publish / deploy operation の永続化
- attachment revision と orphan cleanup の厳密化
- shared schema / package 化

## work log 記録ルール

- substantial な作業のまとまりが終わったら 1 エントリ追加する
- 何を変えたかだけでなく、なぜ価値があるかを書く
- 細かい commit 全部を書き写すのではなく、流れを回収できる粒度にする
