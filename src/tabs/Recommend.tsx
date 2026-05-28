import React, { useState, useRef, useEffect } from 'react'
import { claudeChatStream, RECOMMEND_SYSTEM_PROMPT, type Message } from '../lib/claude'
import { useAppContext } from '../App'

const C = {
  bg: '#1a1a2e',
  surface: '#16213e',
  surfaceHover: '#1a2548',
  border: 'rgba(192,57,43,0.25)',
  accent: '#c0392b',
  accentHover: '#a93226',
  text: '#f5f0e8',
  textMuted: 'rgba(245,240,232,0.5)',
  textDim: 'rgba(245,240,232,0.3)',
}

interface SavedAlbum {
  id: string
  text: string
  savedAt: string
}

const s: Record<string, React.CSSProperties> = {
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: C.bg,
    color: C.text,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    padding: '20px 24px 16px',
    borderBottom: `1px solid ${C.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  chatPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputRow: {
    padding: '16px 24px',
    borderTop: `1px solid ${C.border}`,
    display: 'flex',
    gap: '12px',
  },
  input: {
    flex: 1,
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    padding: '10px 14px',
    color: C.text,
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    resize: 'none' as const,
    minHeight: '44px',
    maxHeight: '120px',
  },
  sendBtn: {
    background: C.accent,
    color: C.text,
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    alignSelf: 'flex-end',
    minWidth: '80px',
  },
  msgBubble: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap' as const,
  },
  wishlistPane: {
    width: '240px',
    borderLeft: `1px solid ${C.border}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  wishlistHeader: {
    padding: '16px',
    borderBottom: `1px solid ${C.border}`,
    fontSize: '13px',
    fontWeight: '600',
    color: C.accent,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  wishlistItems: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  wishlistItem: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '6px',
    padding: '10px 12px',
    fontSize: '12px',
    lineHeight: '1.5',
    color: C.text,
    position: 'relative' as const,
  },
  removeBtn: {
    position: 'absolute' as const,
    top: '6px',
    right: '6px',
    background: 'none',
    border: 'none',
    color: C.textDim,
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    padding: '0',
  },
}

const WISHLIST_KEY = 'mimichou_wishlist'

function loadWishlist(): SavedAlbum[] {
  try {
    const stored = localStorage.getItem(WISHLIST_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function Recommend() {
  const { listeningProfile } = useAppContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [wishlist, setWishlist] = useState<SavedAlbum[]>(loadWishlist)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist)) } catch {}
  }, [wishlist])

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0 && listeningProfile) {
      setMessages([{
        role: 'assistant',
        content: 'こんにちは！あなたのリスニング履歴を拝見しました。\nアルバムの推薦をご希望ですか？「おすすめのアルバムを教えて」と入力するか、「もっとアップテンポで」「〇〇に近い雰囲気で」など具体的なリクエストもどうぞ。'
      }])
    }
  }, [listeningProfile])

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    const systemPrompt = RECOMMEND_SYSTEM_PROMPT(listeningProfile)

    let buffer = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      for await (const chunk of claudeChatStream(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        systemPrompt
      )) {
        buffer += chunk
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: buffer }
          return updated
        })
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `エラーが発生しました: ${err instanceof Error ? err.message : String(err)}`
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function saveSelection() {
    const sel = window.getSelection()?.toString().trim()
    if (!sel) return
    const album: SavedAlbum = {
      id: Date.now().toString(),
      text: sel,
      savedAt: new Date().toLocaleDateString('ja-JP'),
    }
    setWishlist(prev => [album, ...prev])
  }

  function removeFromWishlist(id: string) {
    setWishlist(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h2 style={s.title}>アルバム推薦</h2>
        <div style={{ fontSize: '12px', color: C.textMuted }}>
          テキストを選択して「気になる」に保存できます
        </div>
      </div>

      <div style={s.body}>
        <div style={s.chatPane}>
          <div style={s.messages}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    ...s.msgBubble,
                    background: msg.role === 'user' ? C.accent : C.surface,
                    color: C.text,
                    border: msg.role === 'assistant' ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  {msg.content}
                  {msg.role === 'assistant' && msg.content && (
                    <button
                      onClick={saveSelection}
                      style={{
                        marginTop: '8px',
                        display: 'block',
                        background: 'none',
                        border: `1px solid ${C.border}`,
                        color: C.textMuted,
                        borderRadius: '4px',
                        padding: '3px 10px',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                      title="選択したテキストを気になるリストに保存"
                    >
                      ＋ 気になる
                    </button>
                  )}
                </div>
              </div>
            ))}
            {streaming && messages[messages.length - 1]?.content === '' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.textDim, fontSize: '13px' }}>
                <span style={{ display: 'inline-flex', gap: '3px' }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: C.accent, opacity: 0.6,
                      animation: `pulse 1s ease-in-out ${i * 0.2}s infinite alternate`
                    }} />
                  ))}
                </span>
                考え中...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={s.inputRow}>
            <textarea
              style={s.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力（Shift+Enterで改行）"
              disabled={streaming}
            />
            <button
              style={{
                ...s.sendBtn,
                opacity: streaming || !input.trim() ? 0.5 : 1,
                cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
              }}
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
            >
              送信
            </button>
          </div>
        </div>

        {/* Wishlist sidebar */}
        <div style={s.wishlistPane}>
          <div style={s.wishlistHeader}>気になる 🎵</div>
          <div style={s.wishlistItems}>
            {wishlist.length === 0 && (
              <div style={{ color: C.textDim, fontSize: '12px', textAlign: 'center', marginTop: '16px' }}>
                気になるアルバムを<br />保存しよう
              </div>
            )}
            {wishlist.map(item => (
              <div key={item.id} style={s.wishlistItem}>
                <button
                  style={s.removeBtn}
                  onClick={() => removeFromWishlist(item.id)}
                  title="削除"
                >
                  ×
                </button>
                <div style={{ paddingRight: '16px' }}>{item.text}</div>
                <div style={{ color: C.textDim, fontSize: '10px', marginTop: '4px' }}>{item.savedAt}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
