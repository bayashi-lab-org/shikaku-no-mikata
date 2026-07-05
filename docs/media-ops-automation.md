# シカクのミカタ 自動運営システム設計書

作成日: 2026-07-05 ／ 稼働環境: Mac Studio (M4 Max/36GB, bayashi-labnoMac-Studio.local)

## 1. 目的

メディア「シカクのミカタ」の運営（コンテンツ作成〜改修〜効果測定）をAIエージェントに委譲し、
人間（オーナー）の関与を **Telegramでの承認判断（PRマージ）のみ** に絞る。

```
┌─────────── Mac Studio（常駐） ───────────┐
│  OpenClaw Gateway                          │
│   ├─ Telegramチャンネル (@openclawmedia_bot)│
│   ├─ cron: shikaku-article-writer 火金8:00 │──→ ヘッドレスClaude ──→ GitHub PR
│   ├─ cron: shikaku-weekly-index-report 土9:00│─→ GSC API計測
│   └─ ローカルLLM gemma4:26b（対話応答）      │
└────────────────────────────────────────┘
         │ 通知・レポート                ↑ マージ（人間の関門）
         ▼                              │
   オーナーのTelegram ────承認──────────┘
                                         │ mainマージ
                                         ▼
                              Vercel自動デプロイ → 本番公開
                                         │
                              インデックス登録リクエスト（Indexing API）
```

## 2. コンポーネント

### 2.1 OpenClaw（自動化のハブ）
- 設定: `~/.openclaw/openclaw.json`
- Telegramチャンネル: `@openclawmedia_bot`、`dmPolicy: "pairing"`（オーナー `telegram:8780382400` のみ承認済み）
- デフォルトモデル: `ollama/gemma4:26b`（ローカル・無料。対話応答用）
- OpenClaw本体は自動更新（`update.auto.enabled: true`, stableチャンネル、リリース6〜18時間後に適用）

### 2.2 定期ジョブ（OpenClaw cron）
| ジョブ名 | スケジュール | 内容 | 配信先 |
|---|---|---|---|
| `shikaku-article-writer` | 火・金 8:00 | 新規記事の生成→PR作成 | Telegram |
| `shikaku-weekly-index-report` | 土 9:00 | インデックス状況・検索数値の計測 | Telegram |

確認コマンド: `openclaw cron list` ／ 削除: `openclaw cron remove <id>`

### 2.3 スクリプト一式（`~/.openclaw/workspace/shikaku-tools/`）
| ファイル | 役割 |
|---|---|
| `generate-article.sh` | GSCデータ取得→ヘッドレスClaude起動→記事PR作成の親スクリプト |
| `article-prompt.md` | Claudeに渡す編集部プロンプト（ネタ選定基準・執筆ルール・PR規約） |
| `check-index.sh` | 重点20記事のURL検査＋28日検索数値のレポート生成 |

### 2.4 認証・API
- GSC / Indexing API: サービスアカウント `~/.claude/skills/google-mcp-setup/service-account.json`
  （`sc-domain:shikaku-no-mikata.com` にオーナー権限。JWT→アクセストークンをスクリプト内で自前発行）
- GitHub: `gh` CLI（org: bayashi-lab-org）
- ヘッドレスClaude: `~/.local/bin/claude -p`（既存のClaude Code認証を使用）

## 3. 記事生成フロー（火・金 8:00）

1. **暴走防止チェック**: `Add:` で始まる未マージPRが2本以上あればスキップ（Telegramにその旨通知）
2. `main` を pull → GSC直近28日のクエリデータ（表示回数順トップ200）を `/tmp/shikaku-gsc-data.json` に取得
3. ヘッドレスClaudeが `article-prompt.md` に従い実行:
   - ネタ選定（優先順: ①表示回数あり×専用記事なしのクエリ → ②既存資格クラスタの検索意図の穴埋め → ③関連資格の新規ガイド）
   - 執筆（frontmatterはCLAUDE.mdスキーマ準拠、`keyword`必須、FAQ 3〜5問、内部リンク3本以上、既存記事と事実整合）
   - `npm run build` 検証 → `article/<slug>` ブランチ → PR作成（本文に選定根拠を明記）
4. 最終出力（タイトル・根拠・PR URL）がTelegramへ配信
5. **オーナーがPRをマージ → Vercelが自動デプロイ → 公開**

### 権限の絞り込み（安全設計）
ヘッドレスClaudeの許可ツールは以下のみ（`--allowedTools`）:
`Read, Glob, Grep, Write, Edit, Bash(ls/git/gh pr create/gh pr list/npm run build)`
これ以外のコマンド実行は不可。公開の最終判断（マージ）は常に人間。

## 4. 効果測定フロー（土 9:00）

`check-index.sh` が重点20記事のインデックス状態（URL Inspection API）と
サイト全体の28日間クリック・表示回数を計測し、基準値（2026-07-05: インデックス0本・表示69回）
との比較レポートをTelegramに配信する。

## 5. 経緯（2026-07-05 初期診断と処置）

- **診断**: 記事154本のほぼ全てがGoogle未発見（28日で表示69回・クリック1回・平均77位）。
  技術要因（robots/sitemap/meta/内部リンク）は問題なし。原因は新規ドメイン（2026-02開設）への
  一括投入＋2026-04-26以降の更新停止によるクロール優先度不足と判断
- **処置**: サイトマップ再送信＋重点20記事のIndexing APIリクエスト → **1時間以内に17本インデックス登録**（即効性を確認）
- **改修**: featured記事が `/sample-post` のまま公開されていた問題をリネームで修正（PR #1）
- **記事**: データ起点の新規記事 PR #2（カラーコーディネーターなるには）、PR #3（コーディネーター資格比較ハブ・自動生成テスト）

## 6. 運用ガイド

### オーナーの日常
- Telegramに届く提案・PRを見て、GitHubでマージするだけ
- ボットへのDMでgemma4に質問・指示も可能（24時間応答）

### トラブル時
- ジョブの状態: `openclaw cron list`（Last/Statusを確認）
- ゲートウェイ: `openclaw status` ／ 再起動: `openclaw gateway restart`
- ログ: `openclaw logs --follow`
- 記事生成を止めたい: `openclaw cron remove <shikaku-article-writerのID>`、または記事PRを2本未マージのまま放置（自動スキップ）

### 既知の制約・注意
- ローカルLLM（gemma4:26b）にweb系ツールが有効＋サンドボックス無し（セキュリティ監査CRITICAL）。
  ボットに未知のURLを読ませない運用で回避中。恒久対応はDockerサンドボックスのイメージビルド後に`agents.defaults.sandbox.mode="all"`
- Indexing APIの送信上限は200件/日
- 記事の品質はヘッドレスClaude依存。量産時はGoogleのスケールドコンテンツ規制に注意（現状の週2本は安全圏）

## 7. 今後の拡張候補

1. 残り約600 URL（記事＋クイズ）の日次インデックス送信ジョブ
2. CTR低迷記事の自動リライト提案（週次レポートと連動）
3. クイズコンテンツの自動増産（フォーマット型化済みのためgemma4でも可能性あり）
4. 他メディア（lovehotel-lab、osoushiki-iroha等）への横展開（本設計の複製で対応可能）
