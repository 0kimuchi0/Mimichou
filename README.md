# 耳帖 (Mimichou)

Spotify のリスニング履歴を分析し、アルバム推薦・BGM 提案を行うデスクトップアプリです。

## 機能

| タブ | 内容 |
|------|------|
| 音歴 | 再生履歴の統計・グラフ表示 |
| 推薦 | Claude によるアルバム推薦チャット |
| BGM | 気分・状況に合わせた BGM 提案 |

### 音歴タブ
- アーティスト別総再生時間 Top 20（横棒グラフ）
- 年別最多再生アーティスト
- 時間帯別・曜日別再生パターン
- 全期間トップ曲 Top 20
- 懐かしのアーティスト（2023年以前によく聴いて2025年以降未再生）

### 推薦タブ
- リスニングプロフィールを自動生成して Claude に渡す
- ストリーミング対応チャット UI
- 気になるアルバムをサイドパネルに保存

### BGM タブ
- 気分（プリセット or 自由入力）・時間帯・シチュエーションを入力
- Claude が BGM を提案
- アーティストタグから Spotify 検索を直接開けるボタン付き

## セットアップ

```bash
# 依存パッケージをインストール
npm install

# 環境変数を設定
cp .env.example .env
# .env を開いて ANTHROPIC_API_KEY を設定

# 開発モードで起動
npm run dev
```

## 環境変数

`.env` ファイルに以下を設定してください。

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Spotify 履歴データの取得方法

1. Spotify の「アカウント」→「プライバシーセンター」→「データをダウンロード」
2. 「拡張ストリーミング履歴」をリクエスト（数日後にメールで届きます）
3. ZIP を展開すると `Streaming_History_Audio_*.json` が複数入っています
4. アプリ起動後、音歴タブの「ファイルを選択」から全ファイルをまとめて選択

## 技術スタック

- [Electron](https://www.electronjs.org/) — クロスプラットフォーム
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [electron-vite](https://electron-vite.org/) — ビルドツール
- [Recharts](https://recharts.org/) — グラフ描画
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-node) — Claude API
