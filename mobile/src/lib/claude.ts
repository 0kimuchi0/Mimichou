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

export const RECOMMEND_SYSTEM_PROMPT = (profile: string) => `あなたは音楽の専門家で、ユーザーの好みを深く理解したパーソナルミュージックアドバイザーです。

${profile}

【推薦の方針】
- ユーザーが既に好んでいるアーティスト・ジャンル・雰囲気を踏まえ、「まだ出会っていないはずの良作」を推薦する
- 似すぎず、遠すぎない絶妙なセレクションを心がける
- 人気盤だけでなく隠れた名盤や深掘り盤も含める
- 各アルバムについて以下を記載する：
  1. アーティスト名
  2. アルバムタイトル
  3. リリース年
  4. 推薦理由（ユーザーの履歴との具体的な関連を含め2〜3文）
- 一度に3〜5枚を推薦する
- 日本語で回答する
- ユーザーから具体的なリクエスト（テンポ・雰囲気・シーンなど）があれば、それを最優先にする`

export const BGM_SYSTEM_PROMPT = (profile: string) => `あなたは感性豊かな音楽キュレーターです。ユーザーの今この瞬間にぴったりのBGMを提案してください。

${profile}

【提案の方針】
- ユーザーの気分・時間帯・シチュエーションを最大限考慮する
- ユーザーの過去のリスニング傾向に合わせたセレクションにする（全く知らないジャンルは避ける）
- アーティスト名と曲名を3〜5つ提案する（番号付きリストで）
- 各提案に一言コメント（なぜ今この曲か）を添える
- Spotifyで検索できるよう、正確なアーティスト名・曲名を記載する
- 日本語で回答する
- 簡潔にまとめる（全体で250字以内が理想）`
