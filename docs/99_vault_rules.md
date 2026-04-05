---
created: 2026-04-05
updated: 2026-04-05
---

# Vault Rules

関連ドキュメント:

- [[00_overview]]
- [[05_vault_map]]
- [[07_decision_log]]
- [[10_work_log]]

## このドキュメントの目的

このファイルは、`docs/` を長期間にわたって使いやすい状態に保つための運用ルールを定義する。

vault はファイルが増えるほど価値が上がるわけではない。  
更新ルールが明確でないと、すぐに stale になり、参照価値を失う。

## Rule 1: docs は living document である

`docs/` は使い捨てメモではない。  
設計、状況、優先順位、決定事項が変わったら更新する。

## Rule 2: Markdown には日付 metadata を付ける

原則:

```yaml
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

編集時ルール:

- `created` は維持
- `updated` は当日の日付に更新

## Rule 3: 事実・判断・未決事項・作業記録を混ぜない

分類:

- 現状の事実: [[01_current_analysis]]
- 理想設計: [[02_architecture]]
- データ定義: [[03_data_model]]
- 改善順序: [[04_roadmap]]
- 決定済み事項: [[07_decision_log]]
- 未決事項: [[09_open_questions]]
- 作業記録: [[10_work_log]]

この分離を崩すと、後から見返したときに何が事実で何が意見か分からなくなる。

## Rule 4: durable な判断は decision log に残す

次のようなものは [[07_decision_log]] に記録する。

- 技術選定
- 運用方針
- 非機能要件の優先順位
- 今後も守るべき制約

一方で、一時的な TODO は decision log に入れない。

## Rule 5: 迷ったら active context を更新する

大きな作業が終わって、いま何が優先かが変わったら [[08_active_context]] を更新する。

これは「いまこの repo に入った人が最初に読む current snapshot」である。

## Rule 6: 未決事項は open questions に隔離する

結論が出ていない論点は [[09_open_questions]] に置く。  
実装者が独断で前提化しそうなものほど、明示的にここへ出す。

## Rule 7: substantial な作業は work log に残す

コード変更のたびに書く必要はないが、次のようなまとまりは [[10_work_log]] に残す。

- フェーズが進んだ
- 運用方式が変わった
- 大きな bug fix をした
- architecture 方針が一段進んだ

## Rule 8: 新しい docs は wikilink で接続する

新しい Markdown を `docs/` に追加したら、少なくとも以下を満たすこと。

- どこから来たかを示す関連ドキュメントがある
- どこで使うかが分かる
- 孤立ファイルにしない

## Rule 9: overview は入口として保つ

[[00_overview]] は常に入口であるべきで、詳細を詰め込みすぎない。  
全体像と読み順を優先し、細部は各ドキュメントへ委譲する。

## Rule 10: AGENTS.md と docs の整合を保つ

`AGENTS.md` は agent の行動規範、`docs/` は project knowledge である。  
どちらかだけ更新してズレると、将来の自律開発で方針がぶれる。

設計・優先順位・運用ルールを変えたときは、必要に応じて両方更新すること。
