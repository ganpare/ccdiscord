# TODO

## タスクリスト

- [ ] README.md に --select オプションについて記述する
- [ ] README.md に --never-sleep オプションについて記述する
- [ ] .gitignore に .env ファイルを追加する（もし未追加の場合）
- [ ] TypeScript の型定義を改善する
- [ ] エラーハンドリングを強化する
- [ ] ユニットテストを追加する

## 完了したタスク

- [x] CLI パーサーを node:util parseArgs に移行
- [x] セッション履歴表示機能を実装
- [x] Never Sleep モードを実装
- [x] deno lint を導入してコード品質チェックを行う
- [x] Claude Code リクエストの失敗時に exponential backoff で最大29分まで延長
- [x] !stop を含むメッセージから !stop を取り除いて再送信する機能を実装
