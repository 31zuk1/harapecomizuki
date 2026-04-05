---
created: 2026-04-05
updated: 2026-04-05
---

# Vault Map

関連ドキュメント:

- [[00_overview]]
- [[01_current_analysis]]
- [[02_architecture]]
- [[03_data_model]]
- [[04_roadmap]]
- [[06_glossary]]
- [[07_decision_log]]
- [[08_active_context]]
- [[09_open_questions]]
- [[10_work_log]]
- [[99_vault_rules]]

## このドキュメントの目的

この vault は情報量が増えるほど価値が上がる一方で、入口が曖昧だと人間にもエージェントにも使いづらくなる。  
このファイルは、どの場面でどのドキュメントを先に読むべきかを示すナビゲーションマップである。

## まず読むもの

新しくこの repo に入った人間またはエージェントは、まず次の順で読む。

1. [[00_overview]]
2. [[05_vault_map]]
3. [[08_active_context]]
4. [[07_decision_log]]
5. [[01_current_analysis]]
6. [[02_architecture]]
7. [[03_data_model]]
8. [[04_roadmap]]

この順番にしている理由は、先に「このプロジェクトは何を目指しているか」「いま何が真実か」「何が既に決まっているか」を掴まないと、分析や設計を読んでも判断を誤りやすいからである。

## 用途別の読み方

### バグ修正から入るとき

読む順:

1. [[08_active_context]]
2. [[01_current_analysis]]
3. [[07_decision_log]]
4. [[10_work_log]]

理由:

- active context で現在の痛点を把握する
- current analysis で責務境界とデータフローを確認する
- decision log で触ってはいけない前提を確認する
- work log で直近の変更点を追う

### アーキテクチャ改善をするとき

読む順:

1. [[00_overview]]
2. [[02_architecture]]
3. [[03_data_model]]
4. [[04_roadmap]]
5. [[07_decision_log]]

### 新機能を足すとき

読む順:

1. [[00_overview]]
2. [[07_decision_log]]
3. [[08_active_context]]
4. [[02_architecture]]
5. [[09_open_questions]]

### 運用トラブルや deploy 問題を扱うとき

読む順:

1. [[08_active_context]]
2. [[01_current_analysis]]
3. [[04_roadmap]]
4. [[10_work_log]]

## ドキュメントごとの役割

### [[00_overview]]

役割:

- プロジェクトの全体像
- この vault が何のために存在するか
- 読み順の大きな入口

### [[01_current_analysis]]

役割:

- いまのコードの責務分解
- データフロー
- 問題点の棚卸し

### [[02_architecture]]

役割:

- 理想形のレイヤ構造
- コンポーネント責務
- 設計方針

### [[03_data_model]]

役割:

- 状態管理とモデルの整理
- 現在の JSON 構造と理想形の差分

### [[04_roadmap]]

役割:

- 優先度つき改善計画
- 段階的移行の順序

### [[06_glossary]]

役割:

- 用語の定義
- 曖昧さの除去

### [[07_decision_log]]

役割:

- 決定済みの設計判断
- なぜその判断をしているか
- 何を勝手に変えてはいけないか

### [[08_active_context]]

役割:

- いま時点での現況
- 現在の痛点
- 近い将来の優先作業

### [[09_open_questions]]

役割:

- まだ決まっていない論点
- エージェントが独断で決めるべきでない分岐

### [[10_work_log]]

役割:

- 作業履歴
- 何をいつ変えたかの軽い記録

### [[99_vault_rules]]

役割:

- vault の更新ルール
- Markdown 運用ルール

## エージェント向けの使い方

自律的に作業するエージェントは、着手前・作業中・作業後で参照先を変えること。

着手前:

- [[08_active_context]]
- [[07_decision_log]]
- [[04_roadmap]]

作業中:

- [[01_current_analysis]]
- [[02_architecture]]
- [[03_data_model]]

作業後:

- [[10_work_log]]
- [[99_vault_rules]]

## この vault が良い状態である条件

良い vault とは、ファイルが多いことではなく、迷ったときに最短で答えへ辿れる状態である。

そのために必要なのは次の 4 つである。

- 情報の入口が明確である
- 重要な設計判断が記録されている
- 現在地と未決事項が分かる
- 更新ルールが明文化されている

このファイルは、その入口を維持するための index である。
