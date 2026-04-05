---
created: 2026-04-05
updated: 2026-04-05
---

# Open Questions

関連ドキュメント:

- [[00_overview]]
- [[02_architecture]]
- [[04_roadmap]]
- [[07_decision_log]]
- [[08_active_context]]

## このドキュメントの目的

このファイルは、まだ決まっていない論点を明確にし、エージェントが独断で踏み越えないための保留領域である。

ここにあるものは「まだ決めていない」のであって、「放置してよい」わけではない。  
必要なタイミングでユーザーと合意し、決まったら [[07_decision_log]] へ昇格させる。

## OQ-001 自動 push の失敗時にどこまで bot が回復を試みるべきか

現状:

- push 失敗時の詳細可視化が弱い

未決:

- 自動 retry を入れるか
- retry 回数と backoff をどうするか
- push reject を自動復旧の対象にするか

なぜ未決か:

- reliability と安全性のバランス設計が必要だから

## OQ-002 publish 後の deploy 状態をどこまで Discord へ返すべきか

候補:

- `deploying` まで返す
- workflow URL まで返す
- 完了後に follow-up message を送る

なぜ未決か:

- GitHub token / polling / background worker の有無で実装の重さが変わるから

## OQ-003 bot の常駐先を何にするか

候補:

- local machine + PM2
- VPS + systemd
- Render / Railway / Fly.io などの小規模クラウド

なぜ未決か:

- コスト、運用手間、常時稼働の必要性がまだ固まっていないから

## OQ-004 slash command をどこまで導入するか

現状:

- `!post`, `!publish`, `!unpublish`, `!status`, `!help`

未決:

- text command を主軸のまま維持するか
- 一部だけ slash に寄せるか

なぜ未決か:

- スマホ入力との相性は slash に利点がある一方で、本文一体型の `!post` は text の方が自然だから

## OQ-005 runtime state を repo 内に持ち続けるか

現状:

- draft, published, uploads, registry が repo 配下にある

未決:

- runtime state と build input を分離するか
- `runtime/` を切るか

なぜ未決か:

- beta では分離した方がきれいだが、移行コストと current simplicity のトレードオフがあるから

## OQ-006 画像の保存先を repo 内に残すか

候補:

- 現状維持
- object storage へ分離

なぜ未決か:

- 利便性と repo 膨張リスクの両方があるから

## OQ-007 publish フローを直接 main push のままにするか

候補:

- 現状の direct push
- PR 作成型

なぜ未決か:

- single-user なら direct push は合理的だが、レビューや履歴管理の要件が増えると PR 型の方が適するから

## OQ-008 revision model をいつ導入するか

現状:

- `hasUnpublishedChanges` は保存されている

未決:

- beta の前半で入れるか
- application 層分離の後で入れるか

なぜ未決か:

- 正しい方向だが、導入タイミングを誤ると移行コストが増えるから

## 未決事項を扱うルール

- 決まっていないことを既成事実化しない
- 未決の分岐で大きなコスト差があるならユーザー確認を取る
- 結論が出たらここから削除するのではなく、[[07_decision_log]] に記録する
