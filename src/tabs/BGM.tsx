import React, { useState } from 'react'
import { claudeChatStream, BGM_SYSTEM_PROMPT } from '../lib/claude'
import { useAppContext } from '../App'

const C = {
  bg: '#1a1a2e',
  surface: '#16213e',
  border: 'rgba(192,57,43,0.25)',
  accent: '#c0392b',
  text: '#f5f0e8',
  textMuted: 'rgba(245,240,232,0.5)',
  textDim: 'rgba(245,240,232,0.3)',
}

const MOOD_PRESETS = [
  '集中したい', 'リラックス', 'テンション上げたい', '眠れない',
  '感傷的な気分', '朝のスタート', '落ち込んでいる', 'ドライブ中',
]

function getCurrentTimeLabel(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 9) return '早朝'
  if (h >= 9 && h < 12) return '午前'
  if (h >= 12 && h < 14) return '昼'
  if (h >= 14 && h < 18) return '午後'
  if (h >= 18 && h < 21) return '夕方'
  if (h >= 21 && h < 24) return '夜'
  return '深夜'
}

const TIME_OPTIONS = ['早朝', '午前', '昼', '午後', '夕方', '夜', '深夜']

interface Suggestion {
  raw: string
  artists: string[]
}

function extractArtists(text: string): string[] {
  const lines = text.split('\n')
  const artists: string[] = []
  for (const line of lines) {
    const m = line.match(/^\s*[\d\-\*\•]+[\.\)：:]?\s*(.+?)(?:\s*[-—–]\s*.+)?$/)
    if (m) {
      const candidate = m[1].trim()
      if (candidate.length > 0 && candidate.length < 60) {
        const artistMatch = candidate.match(/^(.+?)\s*[「『""]/)
        artists.push(artistMatch ? artistMatch[1].trim() : candidate)
      }
    }
  }
  return [...new Set(artists)].slice(0, 8)
}

const s: Record<string, React.CSSProperties> = {
  root: {
    height: '100%',
    overflowY: 'auto',
    background: C.bg,
    color: C.text,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '24px',
  },
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
  },
  label: {
    fontSize: '12px',
    color: C.accent,
    fontWeight: '600',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginBottom: '12px',
    display: 'block',
  },
  presetRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
    marginBottom: '12px',
  },
  presetBtn: {
    background: 'none',
    border: `1px solid ${C.border}`,
    borderRadius: '20px',
    padding: '6px 16px',
    color: C.textMuted,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  textInput: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    padding: '10px 14px',
    color: C.text,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  selectInput: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    padding: '10px 14px',
    color: C.text,
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    minWidth: '140px',
  },
  generateBtn: {
    width: '100%',
    background: C.accent,
    color: C.text,
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '16px',
    cursor: 'pointer',
    fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
    letterSpacing: '0.08em',
    marginTop: '4px',
  },
  resultCard: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    padding: '20px',
    marginTop: '20px',
  },
  resultText: {
    fontSize: '14px',
    lineHeight: '1.8',
    color: C.text,
    whiteSpace: 'pre-wrap' as const,
  },
  artistGrid: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: `1px solid ${C.border}`,
  },
  artistTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(192,57,43,0.15)',
    border: `1px solid rgba(192,57,43,0.4)`,
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '13px',
    color: C.text,
  },
  spotifyBtn: {
    background: '#1DB954',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '3px 10px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
  },
}

export function BGM() {
  const { listeningProfile } = useAppContext()
  const [mood, setMood] = useState('')
  const [timeOfDay, setTimeOfDay] = useState(getCurrentTimeLabel())
  const [situation, setSituation] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [result, setResult] = useState<Suggestion | null>(null)
  const [error, setError] = useState<string | null>(null)

  function selectPreset(preset: string) {
    setMood(mood === preset ? '' : preset)
  }

  async function generate() {
    if (streaming) return
    setError(null)
    setResult(null)
    setStreaming(true)

    const userMessage = [
      `気分: ${mood || '特になし'}`,
      `時間帯: ${timeOfDay}`,
      situation ? `状況: ${situation}` : null,
    ].filter(Boolean).join('\n')

    const systemPrompt = BGM_SYSTEM_PROMPT(listeningProfile)
    let buffer = ''

    setResult({ raw: '', artists: [] })

    try {
      for await (const chunk of claudeChatStream(
        [{ role: 'user', content: userMessage }],
        systemPrompt
      )) {
        buffer += chunk
        setResult({ raw: buffer, artists: [] })
      }
      setResult({ raw: buffer, artists: extractArtists(buffer) })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setResult(null)
    } finally {
      setStreaming(false)
    }
  }

  function openSpotify(artist: string) {
    const url = `https://open.spotify.com/search/${encodeURIComponent(artist)}`
    window.open(url, '_blank')
  }

  return (
    <div style={s.root}>
      <h2 style={{ margin: '0 0 20px', fontFamily: '"Hiragino Mincho ProN", serif', fontSize: '22px' }}>
        BGM セレクター
      </h2>

      <div style={s.card}>
        <span style={s.label}>今の気分</span>
        <div style={s.presetRow}>
          {MOOD_PRESETS.map(preset => (
            <button
              key={preset}
              style={{
                ...s.presetBtn,
                background: mood === preset ? C.accent : 'none',
                color: mood === preset ? C.text : C.textMuted,
                borderColor: mood === preset ? C.accent : C.border,
              }}
              onClick={() => selectPreset(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
        <input
          style={s.textInput}
          type="text"
          value={mood}
          onChange={e => setMood(e.target.value)}
          placeholder="または自由に入力（例: 雨の日に合う音楽）"
        />
      </div>

      <div style={s.card}>
        <span style={s.label}>時間帯</span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            style={s.selectInput}
            value={timeOfDay}
            onChange={e => setTimeOfDay(e.target.value)}
          >
            {TIME_OPTIONS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            style={{
              background: 'none',
              border: `1px solid ${C.border}`,
              borderRadius: '6px',
              padding: '8px 14px',
              color: C.textMuted,
              cursor: 'pointer',
              fontSize: '12px',
            }}
            onClick={() => setTimeOfDay(getCurrentTimeLabel())}
          >
            現在時刻から自動取得
          </button>
        </div>
      </div>

      <div style={s.card}>
        <span style={s.label}>シチュエーション（任意）</span>
        <input
          style={s.textInput}
          type="text"
          value={situation}
          onChange={e => setSituation(e.target.value)}
          placeholder="例: 在宅ワーク中、ドライブ、読書しながら"
        />
      </div>

      <button
        style={{
          ...s.generateBtn,
          opacity: streaming ? 0.6 : 1,
          cursor: streaming ? 'not-allowed' : 'pointer',
        }}
        onClick={generate}
        disabled={streaming}
      >
        {streaming ? '提案中...' : 'BGMを提案してもらう'}
      </button>

      {error && (
        <div style={{ color: C.accent, fontSize: '13px', marginTop: '12px' }}>
          エラー: {error}
        </div>
      )}

      {result && (
        <div style={s.resultCard}>
          <div style={{ fontSize: '12px', color: C.accent, fontWeight: '600', letterSpacing: '0.08em', marginBottom: '12px' }}>
            AIの提案
          </div>
          <div style={s.resultText}>{result.raw}</div>

          {result.artists.length > 0 && (
            <>
              <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '16px', marginBottom: '8px' }}>
                Spotifyで検索:
              </div>
              <div style={s.artistGrid}>
                {result.artists.map((artist, i) => (
                  <div key={i} style={s.artistTag}>
                    <span>{artist}</span>
                    <button
                      style={s.spotifyBtn}
                      onClick={() => openSpotify(artist)}
                      title={`Spotifyで「${artist}」を検索`}
                    >
                      ▶ Spotify
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
