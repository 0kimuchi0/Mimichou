export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface ClaudeAPI {
  openFiles: () => Promise<Array<{ name: string; content: string }>>
  claudeChat: (
    messages: Message[],
    systemPrompt: string
  ) => Promise<{ success: boolean; content?: string; error?: string }>
  claudeChatStream: (
    messages: Message[],
    systemPrompt: string
  ) => Promise<{ success: boolean; error?: string }>
  onStreamChunk: (callback: (text: string) => void) => void
  onStreamEnd: (callback: () => void) => void
  onStreamError: (callback: (error: string) => void) => void
  removeStreamListeners: () => void
}

declare global {
  interface Window {
    api: ClaudeAPI
  }
}

export function getApi(): ClaudeAPI {
  if (!window.api) {
    throw new Error('Electron API not available')
  }
  return window.api
}

export const RECOMMEND_SYSTEM_PROMPT = (profile: string) => `あなたは音楽の専門家です。ユーザーのSpotifyリスニング履歴に基づいて、アルバムを推薦してください。

${profile}

【推薦ルール】
- ユーザーがまだ聴いていないと思われるアルバムを推薦する
- 各アルバムについて：アーティスト名、アルバム名、リリース年、推薦理由（2〜3文）を記載
- 日本語で回答する
- ユーザーの好みに合わせた具体的な理由を述べる
- 一度に3〜5枚程度のアルバムを推薦する`

export const BGM_SYSTEM_PROMPT = (profile: string) => `あなたは音楽キュレーターです。ユーザーの現在の気分や状況に合わせたBGMを提案してください。

${profile}

【提案ルール】
- ユーザーの気分・状況・時間帯を考慮する
- アーティスト名と曲名を3〜5つ提案する
- 各提案に一言コメントを添える
- Spotifyで検索できるよう、正確なアーティスト名・曲名を記載
- 日本語で回答する
- 簡潔にまとめる（長すぎない）`
