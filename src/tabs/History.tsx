import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts'
import { parseFiles, buildListeningProfile, formatMinutes, type ParsedData } from '../lib/parser'
import { useAppContext } from '../App'
import { saveHistoryStats, fetchCloudData } from '../lib/db'

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
    fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
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
    fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
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
    fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
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
  const { parsedData, setParsedData, setListeningProfile, token } = useAppContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedInfo, setLoadedInfo] = useState<string | null>(null)
  const [cloudSaving, setCloudSaving] = useState(false)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudInfo, setCloudInfo] = useState<string | null>(null)

  // Auto-restore from cloud on mount when logged in and no data loaded
  useEffect(() => {
    if (!token || parsedData) return
    fetchCloudData(token).then(data => {
      if (!data?.historyStats) return
      const hs = data.historyStats
      const restored = {
        entries: [],
        topArtists: (hs.topArtists ?? []) as import('../lib/parser').ArtistStats[],
        topTracks: (hs.topTracks ?? []) as import('../lib/parser').TrackStats[],
        hourlyStats: [],
        dayStats: [],
        topArtistPerYear: [],
        nostalgicArtists: [],
        totalEntries: hs.totalEntries,
        dateRange: hs.dateRange,
      }
      setParsedData(restored)
      setListeningProfile(buildListeningProfile(restored))
      setLoadedInfo(`クラウドから復元: ${hs.totalEntries.toLocaleString()}件 (${hs.uploadedAt?.slice(0, 10) ?? ''})`)
    })
  }, [token])

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
      if (data.totalEntries === 0) {
        setError('対応形式のデータが見つかりませんでした。Spotify JSON、Apple Music CSV、YouTube Music JSON、Amazon Music CSVに対応しています。')
        setLoading(false)
        return
      }
      setParsedData(data)
      setListeningProfile(buildListeningProfile(data))
      setLoadedInfo(`${files.length}ファイル・${data.totalEntries.toLocaleString()}件を読み込みました`)

      // Auto-save stats to cloud if logged in
      if (token) {
        setCloudSaving(true)
        saveHistoryStats(token, {
          topArtists: data.topArtists.slice(0, 20).map(a => ({ artist: a.artist, totalMinutes: a.totalMinutes, playCount: a.playCount })),
          topTracks: data.topTracks.slice(0, 20).map(t => ({ track: t.track, artist: t.artist, totalMinutes: t.totalMinutes, playCount: t.playCount })),
          dateRange: data.dateRange,
          totalEntries: data.totalEntries,
        }).finally(() => setCloudSaving(false))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  if (!parsedData) {
    return (
      <div style={{ ...s.root, overflowY: 'auto' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '36px', fontFamily: '"Hiragino Mincho ProN", serif', color: C.text, marginBottom: '6px', letterSpacing: '0.08em' }}>
              耳帖
            </div>
            <div style={{ fontSize: '12px', color: C.textDim, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Mimichou
            </div>
          </div>

          {/* File upload card */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '24px', marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: C.text, marginBottom: '10px' }}>
              ファイルから読み込む
            </div>
            <div style={{ fontSize: '13px', color: C.textMuted, lineHeight: '1.7', marginBottom: '18px' }}>
              各サービスのデータエクスポートファイルを選択してください。複数ファイルを同時に選択できます。
            </div>

            <div style={{ marginBottom: '20px' }}>
              {[
                { name: 'Spotify', how: 'アカウント設定 → プライバシー → データのダウンロード', file: 'Streaming_History_*.json' },
                { name: 'Apple Music', how: 'privacy.apple.com → データを取得 → Apple Music', file: 'Play Activity.csv' },
                { name: 'YouTube Music', how: 'Google Takeout → YouTube と YouTube Music', file: 'watch-history.json' },
                { name: 'Amazon Music', how: 'Amazonカスタマーサービスにリクエスト', file: 'AmazonMusic*.csv' },
              ].map(s2 => (
                <div key={s2.name} style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.accent, marginTop: '7px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: C.text }}>{s2.name}</div>
                    <div style={{ fontSize: '11px', color: C.textDim, marginTop: '2px' }}>{s2.how}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(192,57,43,0.7)', marginTop: '2px', fontFamily: 'monospace' }}>{s2.file}</div>
                  </div>
                </div>
              ))}
            </div>

            <label style={{ ...s.loadBtn, display: 'block', textAlign: 'center', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? '読み込み中...' : 'ファイルを選択する'}
              <input
                type="file"
                multiple
                accept=".json,.csv"
                style={{ display: 'none' }}
                onChange={handleLoadFiles}
                disabled={loading}
              />
            </label>
            {error && <div style={{ color: C.accent, fontSize: '13px', marginTop: '10px' }}>{error}</div>}
          </div>

          {/* Cloud restore (logged-in users only) */}
          {token && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: C.text }}>クラウドから復元</div>
                <div style={{ fontSize: '11px', color: C.textDim, marginTop: '3px' }}>前回アップロードした統計データを読み込む</div>
              </div>
              <button
                style={{ ...s.loadBtn, padding: '8px 16px', fontSize: '12px', display: 'inline-block', cursor: cloudLoading ? 'not-allowed' : 'pointer', opacity: cloudLoading ? 0.6 : 1, whiteSpace: 'nowrap' }}
                disabled={cloudLoading}
                onClick={async () => {
                  setCloudLoading(true)
                  setError(null)
                  const data = await fetchCloudData(token)
                  setCloudLoading(false)
                  if (!data?.historyStats) {
                    setError('クラウドにデータが見つかりませんでした。先にファイルをアップロードしてください。')
                    return
                  }
                  const hs = data.historyStats
                  const restored = {
                    entries: [],
                    topArtists: (hs.topArtists ?? []) as import('../lib/parser').ArtistStats[],
                    topTracks: (hs.topTracks ?? []) as import('../lib/parser').TrackStats[],
                    hourlyStats: [],
                    dayStats: [],
                    topArtistPerYear: [],
                    nostalgicArtists: [],
                    totalEntries: hs.totalEntries,
                    dateRange: hs.dateRange,
                  }
                  setParsedData(restored)
                  setListeningProfile(buildListeningProfile(restored))
                  setLoadedInfo(`クラウドから復元: ${hs.totalEntries.toLocaleString()}件 (${hs.uploadedAt?.slice(0, 10) ?? ''})`)
                }}
              >
                {cloudLoading ? '読み込み中...' : '復元する'}
              </button>
            </div>
          )}
          {cloudInfo && <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '10px', textAlign: 'center' }}>{cloudInfo}</div>}
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
        <div>
          <h2 style={{ margin: 0, fontFamily: '"Hiragino Mincho ProN", serif', fontSize: '22px' }}>
            音楽履歴レポート
          </h2>
          {loadedInfo && (
            <div style={{ fontSize: '11px', color: C.textDim, marginTop: '4px' }}>
              {loadedInfo}
              {cloudSaving && <span style={{ marginLeft: '8px', color: 'rgba(192,57,43,0.6)' }}>☁ 保存中...</span>}
            </div>
          )}
        </div>
        <label style={{ ...s.loadBtn, padding: '8px 16px', fontSize: '13px', display: 'inline-block', cursor: 'pointer' }}>
          再読み込み
          <input
            type="file"
            multiple
            accept=".json,.csv"
            style={{ display: 'none' }}
            onChange={handleLoadFiles}
          />
        </label>
      </div>

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
        <div style={{ height: `${artistChartData.length * 44 + 20}px` }}>
          <ResponsiveContainer width="100%" height="100%">
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
