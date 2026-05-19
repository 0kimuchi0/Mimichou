const API_BASE = 'https://mimichou.vercel.app'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function* claudeChatStream(
  messages: Message[],
  systemPrompt: string
): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt, stream: true }),
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          if (parsed.text) yield parsed.text
        } catch {}
      }
    }
  }
}

export const RECOMMEND_SYSTEM_PROMPT = (profile: string) => `あなたは音楽の専門家です。ユーザーのリスニング履歴に基づいて、アルバムを推薦してください。

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
