import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts'
import { parseFiles, buildListeningProfile, formatMinutes, type ParsedData } from '../lib/parser'
import { useAppContext } from '../App'
import {
  startSpotifyLogin,
  handleOAuthCallback,
  fetchRecentlyPlayed,
  convertToSpotifyEntries,
  getClientId,
} from '../lib/spotify'

const C = {
  bg: '#1a1a2e',
  surface: '#16213e',
  border: 'rgba(192,57,43,0.25)',
  accent: '#c0392b',
  text: '#f5f0e8',
  textMuted: 'rgba(245,240,232,0.5)',
  textDim: 'rgba(245,240,232,0.3)',
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
  section: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: C.accent,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '16px',
    margin: '0 0 16px',
    fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", system-ui, sans-serif',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  th: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    color: C.textMuted,
    fontWeight: '500',
    borderBottom: `1px solid ${C.border}`,
    fontSize: '12px',
  },
  td: {
    padding: '8px 12px',
    borderBottom: `1px solid rgba(192,57,43,0.1)`,
    color: C.text,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
    color: C.textMuted,
  },
  loadBtn: {
    background: C.accent,
    color: C.text,
    border: 'none',
    borderRadius: '6px',
    padding: '12px 24px',
    fontSize: '15px',
    cursor: 'pointer',
    fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", system-ui, sans-serif',
    letterSpacing: '0.05em',
  },
  statsRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  },
  statCard: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    padding: '16px 20px',
    flex: '1',
    minWidth: '140px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: C.text,
    fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", system-ui, sans-serif',
  },
  statLabel: {
    fontSize: '11px',
    color: C.textMuted,
    letterSpacing: '0.1em',
    marginTop: '4px',
  },
}

const tooltipStyle = {
  backgroundColor: '#16213e',
  border: '1px solid rgba(192,57,43,0.4)',
  borderRadius: '6px',
  color: '#f5f0e8',
  fontSize: '12px',
}

export function History() {
  const { parsedData, setParsedData, setListeningProfile } = useAppContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spotifyLoading, setSpotifyLoading] = useState(false)
  const [spotifyError, setSpotifyError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) return

    // Remove code from URL without reload
    window.history.replaceState({}, '', '/')

    setSpotifyLoading(true)
    handleOAuthCallback(code)
      .then(token => fetchRecentlyPlayed(token))
      .then(items => {
        if (items.length === 0) throw new Error('再生履歴がありません')
        const files = convertToSpotifyEntries(items)
        const data = parseFiles(files)
        setParsedData(data)
        setListeningProfile(buildListeningProfile(data))
      })
      .catch(e => setSpotifyError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSpotifyLoading(false))
  }, [])

  async function handleLoadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const fileContents = await Promise.all(
        files.map(f => new Promise<{ name: string; content: string }>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve({ name: f.name, content: reader.result as string })
          reader.onerror = reject
          reader.readAsText(f)
        }))
      )
      const data = parseFiles(fileContents)
      setParsedData(data)
      setListeningProfile(buildListeningProfile(data))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  if (!parsedData) {
    return (
      <div style={{ ...s.root, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '40px' }}>
        <div style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Title */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '12px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(192,57,43,0.7)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
            <div style={{ fontSize: '22px', fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", system-ui, sans-serif', color: C.text, marginBottom: '6px' }}>
              音楽履歴を読み込む
            </div>
            <div style={{ fontSize: '13px', color: C.textMuted }}>
              2つの方法で Spotify の再生履歴を取り込めます
            </div>
          </div>

          {/* Option A: Spotify Login */}
          {getClientId() && (
            <div style={{
              background: 'rgba(29,185,84,0.08)',
              border: '1px solid rgba(29,185,84,0.3)',
              borderRadius: '10px',
              padding: '20px 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#1DB954' }}>方法①　Spotify でログイン（自動取得）</span>
              </div>
              <div style={{ fontSize: '13px', color: C.textMuted, lineHeight: '1.8', marginBottom: '16px' }}>
                ボタンひとつで今すぐ使えます。ただし Spotify API の制限により、<strong style={{ color: C.text }}>直近 50〜250 曲程度</strong>（ここ数日〜数週間分）しか取得できません。<br />
                年別グラフや「懐かしのアーティスト」など長期分析には向きませんが、推薦・BGM 機能はすぐに試せます。
              </div>
              <button
                style={{
                  background: '#1DB954',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '11px 24px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: spotifyLoading || loading ? 'not-allowed' : 'pointer',
                  opacity: spotifyLoading || loading ? 0.6 : 1,
                }}
                onClick={() => startSpotifyLogin().catch(e => setSpotifyError(e instanceof Error ? e.message : String(e)))}
                disabled={loading || spotifyLoading}
              >
                {spotifyLoading ? '取得中...' : '▶ Spotify でログイン'}
              </button>
              {spotifyError && <div style={{ color: C.accent, fontSize: '12px', marginTop: '8px' }}>{spotifyError}</div>}
            </div>
          )}

          {/* Option B: File Upload */}
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: '10px',
            padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(245,240,232,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span style={{ fontSize: '15px', fontWeight: '700', color: C.text }}>
                {getClientId() ? '方法②　ファイルを読み込む（全履歴・推奨）' : '履歴ファイルを読み込む'}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: C.textMuted, lineHeight: '1.8', marginBottom: '16px' }}>
              Spotify から<strong style={{ color: C.text }}>数年分の全再生履歴</strong>を取り込めます。分析精度が高く、すべての機能をフル活用できます。<br />
              ただし、事前にデータを入手する必要があります（申請から受け取りまで数日かかります）。
              <br /><br />
              <strong style={{ color: C.text }}>データの入手方法：</strong><br />
              1. <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>Spotify プライバシー設定</a> を開く<br />
              2.「拡張ストリーミング履歴」をリクエスト<br />
              3. 数日後に届くメールからダウンロード<br />
              4. ZIP を展開し、<code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>Streaming_History_Audio_*.json</code> を選択
            </div>
            <label style={{
              display: 'inline-block',
              background: C.accent,
              color: C.text,
              border: 'none',
              borderRadius: '6px',
              padding: '11px 24px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading || spotifyLoading ? 'not-allowed' : 'pointer',
              opacity: loading || spotifyLoading ? 0.6 : 1,
              fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", system-ui, sans-serif',
            }}>
              {loading ? '読み込み中...' : 'ファイルを選択'}
              <input
                type="file"
                multiple
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleLoadFiles}
                disabled={loading || spotifyLoading}
              />
            </label>
            {error && <div style={{ color: C.accent, fontSize: '12px', marginTop: '8px' }}>{error}</div>}
          </div>
        </div>
      </div>
    )
  }

  const totalMinutes = parsedData.topArtists.reduce((sum, a) => sum + a.totalMinutes, 0)
  const totalHours = Math.floor(totalMinutes / 60)

  const artistChartData = parsedData.topArtists.slice(0, 20).map(a => ({
    artist: a.artist.length > 18 ? a.artist.slice(0, 18) + '…' : a.artist,
    minutes: a.totalMinutes,
    label: formatMinutes(a.totalMinutes),
  }))

  const hourChartData = parsedData.hourlyStats.map(h => ({
    hour: `${h.hour}時`,
    count: h.playCount,
  }))

  const dayChartData = parsedData.dayStats.map(d => ({
    day: d.day + '曜',
    count: d.playCount,
  }))

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", system-ui, sans-serif', fontSize: '22px' }}>
          音楽履歴レポート
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {getClientId() && (
            <button
              style={{
                ...s.loadBtn,
                padding: '8px 16px',
                fontSize: '13px',
                background: '#1DB954',
                color: '#000',
                fontWeight: '700',
              }}
              onClick={() => startSpotifyLogin().catch(e => setSpotifyError(e instanceof Error ? e.message : String(e)))}
              disabled={spotifyLoading}
            >
              {spotifyLoading ? '取得中...' : 'Spotify 再取得'}
            </button>
          )}
          <label style={{ ...s.loadBtn, padding: '8px 16px', fontSize: '13px', display: 'inline-block' }}>
            再読み込み
            <input
              type="file"
              multiple
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleLoadFiles}
            />
          </label>
        </div>
      </div>

      {spotifyError && (
        <div style={{ color: '#1DB954', fontSize: '13px', marginBottom: '12px' }}>{spotifyError}</div>
      )}

      {/* Stats summary */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statValue}>{parsedData.totalEntries.toLocaleString()}</div>
          <div style={s.statLabel}>総再生数</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statValue}>{totalHours.toLocaleString()}<span style={{ fontSize: '14px' }}>時間</span></div>
          <div style={s.statLabel}>総再生時間（推計）</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statValue}>{parsedData.topArtists.length}</div>
          <div style={s.statLabel}>アーティスト数</div>
        </div>
        <div style={s.statCard}>
          <div style={{ fontSize: '13px', color: C.text }}>{parsedData.dateRange.from}</div>
          <div style={{ fontSize: '13px', color: C.text }}> 〜 {parsedData.dateRange.to}</div>
          <div style={s.statLabel}>データ期間</div>
        </div>
      </div>

      {/* 1. Top 20 Artists Bar Chart */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>アーティスト別 総再生時間 Top 20</h3>
        <ResponsiveContainer width="100%" height={480}>
          <BarChart
            data={artistChartData}
            layout="vertical"
            margin={{ top: 0, right: 80, left: 140, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(192,57,43,0.15)" />
            <XAxis type="number" tick={{ fill: C.textMuted, fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="artist"
              tick={{ fill: C.text, fontSize: 12 }}
              width={140}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(val: number) => [formatMinutes(val), '再生時間']}
            />
            <Bar dataKey="minutes" fill={C.accent} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2. Top Artist Per Year */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>年別 最もよく聴いたアーティスト</h3>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>年</th>
              <th style={s.th}>アーティスト</th>
              <th style={s.th}>再生時間</th>
            </tr>
          </thead>
          <tbody>
            {parsedData.topArtistPerYear.map((row) => (
              <tr key={row.year}>
                <td style={{ ...s.td, color: C.accent, fontWeight: '600' }}>{row.year}</td>
                <td style={s.td}>{row.artist}</td>
                <td style={{ ...s.td, color: C.textMuted }}>{formatMinutes(row.totalMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Hourly Pattern */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>時間帯別 再生パターン</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={hourChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(192,57,43,0.15)" />
            <XAxis dataKey="hour" tick={{ fill: C.textMuted, fontSize: 11 }} />
            <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, '再生回数']} />
            <Line
              type="monotone"
              dataKey="count"
              stroke={C.accent}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: C.accent }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 4. Day of Week Pattern */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>曜日別 再生パターン</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dayChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(192,57,43,0.15)" />
            <XAxis dataKey="day" tick={{ fill: C.textMuted, fontSize: 12 }} />
            <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, '再生回数']} />
            <Bar dataKey="count" fill={C.accent} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 5. Top 20 Tracks */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>全期間トップ曲 Top 20</h3>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, width: '36px' }}>#</th>
              <th style={s.th}>曲名</th>
              <th style={s.th}>アーティスト</th>
              <th style={s.th}>再生回数</th>
              <th style={s.th}>再生時間</th>
            </tr>
          </thead>
          <tbody>
            {parsedData.topTracks.map((track, i) => (
              <tr key={i}>
                <td style={{ ...s.td, color: C.textDim, textAlign: 'center' }}>{i + 1}</td>
                <td style={s.td}>{track.track}</td>
                <td style={{ ...s.td, color: C.textMuted }}>{track.artist}</td>
                <td style={{ ...s.td, color: C.textMuted }}>{track.playCount.toLocaleString()}</td>
                <td style={{ ...s.td, color: C.textMuted }}>{formatMinutes(track.totalMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 6. Nostalgic Artists */}
      {parsedData.nostalgicArtists.length > 0 && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>懐かしのアーティスト</h3>
          <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '12px' }}>
            2023年以前によく聴いて、2025年以降は未再生のアーティスト
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>アーティスト</th>
                <th style={s.th}>最後に聴いた年</th>
                <th style={s.th}>当時の再生時間</th>
              </tr>
            </thead>
            <tbody>
              {parsedData.nostalgicArtists.map((a) => (
                <tr key={a.artist}>
                  <td style={s.td}>{a.artist}</td>
                  <td style={{ ...s.td, color: C.textMuted }}>{a.lastYear}年</td>
                  <td style={{ ...s.td, color: C.textMuted }}>{formatMinutes(a.preMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
