---
created: 2026-04-05
updated: 2026-04-05
---

# Decision Log

関連ドキュメント:

- [[00_overview]]
- [[02_architecture]]
- [[03_data_model]]
- [[08_active_context]]
- [[09_open_questions]]

## このドキュメントの目的

このファイルは、すでに決まっている設計判断を残すための decision log である。  
ここに書かれているものは、エージェントが独断で覆してはいけない前提に近い。

変更したい場合は、まずこのファイルを更新し、必要なら関連ドキュメントも合わせて直すこと。

## D-001 Discord-first authoring

- Date: 2026-04-05
- Status: Active

Decision:

主要な入力チャネルは Discord とする。

Rationale:

- スマホ中心の更新を成立させることがこのプロジェクトの根本目的だから
- 別 CMS や admin UI を増やすとプロダクトの焦点がぼけるから

Implications:

- Discord adapter は最重要 adapter である
- UX 改善はまず Discord 上で考える

## D-002 Draft と Published Snapshot は分離する

- Date: 2026-04-05
- Status: Active

Decision:

draft 更新と public site 更新は分離し、publish を境界にする。

Rationale:

- 誤編集で公開内容が即変わるのを避けたい
- Discord の message edit を安全に扱いたい

Implications:

- publish 後 edit で live が自動更新されてはいけない
- `hasUnpublishedChanges` またはそれに相当する概念は必要

## D-003 Database は当面導入しない

- Date: 2026-04-05
- Status: Active

Decision:

beta までは file-based persistence を維持する。

Rationale:

- 単一ユーザー運用と low-cost operation が前提だから
- 問題の本質は DB 不足ではなく責務分離不足だから

Implications:

- まず JSON / markdown / uploads を抽象化する
- repository port を先に切る

## D-004 GitHub Pages を標準公開先として維持する

- Date: 2026-04-05
- Status: Active

Decision:

公開先のデフォルトは GitHub Pages とする。

Rationale:

- 現状ですでに動作しており、コストが低い
- 静的サイトとの相性がよい

Implications:

- publish と deploy は別段階として扱う
- base path, Pages workflow, deploy latency を model に反映すべき

## D-005 Single-tenant を維持する

- Date: 2026-04-05
- Status: Active

Decision:

このシステムは single-tenant 前提で設計する。

Rationale:

- 現在の運用想定に対して最も合理的だから
- 複数テナント化は設計を大きく変えるが、それは現時点の目的ではないから

Implications:

- 認可や namespace を過剰設計しない
- ただし user / actor / role の概念は残す

## D-006 `messageId` tracking を維持する

- Date: 2026-04-05
- Status: Active

Decision:

Discord source message の `messageId` を draft tracking の重要キーとして維持する。

Rationale:

- 同じ message の edit が draft 更新につながる仕様の中心だから

Implications:

- message edit の再起動耐性は重要
- source message と internal post id は将来的に分離可能だが、紐付け自体は維持する

## D-007 docs/ は living vault として扱う

- Date: 2026-04-05
- Status: Active

Decision:

`docs/` は使い捨て設計メモではなく、長期運用する project vault とする。

Rationale:

- 人間も agent も同じ参照基盤を持つ方が継続開発しやすい
- 長時間の自律作業には記憶の外部化が必要だから

Implications:

- docs は更新され続ける前提
- Markdown には日付 metadata を付ける
- decision, active context, open questions, work log を残す

## D-008 まず reliability を上げ、その後に feature を増やす

- Date: 2026-04-05
- Status: Active

Decision:

ベータ化に向けた優先順位は、機能追加よりも運用安定化を先に置く。

Rationale:

- すでに投稿・編集・publish・Pages 公開は成立している
- いま足りないのは reliability, observability, autonomous operation だから

Implications:

- bot 常駐化
- git/deploy 可視化
- queue / state management
- その後に追加 command や site polish

## この decision log を更新すべきとき

- 新しい durable decision をしたとき
- 既存判断を覆したとき
- roadmap の優先順位を変えるだけでは足りず、設計方針そのものが変わったとき

未決事項は [[09_open_questions]] に書く。  
決めたことだけをここに残す。
