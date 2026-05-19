export interface SpotifyEntry {
  ts: string
  ms_played: number
  master_metadata_track_name: string | null
  master_metadata_album_artist_name: string | null
  master_metadata_album_album_name: string | null
}

export interface ArtistStats {
  artist: string
  totalMs: number
  totalMinutes: number
  playCount: number
}

export interface TrackStats {
  track: string
  artist: string
  album: string
  totalMs: number
  totalMinutes: number
  playCount: number
}

export interface HourlyStats {
  hour: number
  playCount: number
  totalMs: number
}

export interface DayStats {
  day: string
  dayIndex: number
  playCount: number
  totalMs: number
}

export interface YearArtist {
  year: number
  artist: string
  totalMs: number
  totalMinutes: number
}

export interface NostalgicArtist {
  artist: string
  preMs: number
  preMinutes: number
  lastYear: number
}

export interface ParsedData {
  entries: SpotifyEntry[]
  topArtists: ArtistStats[]
  topTracks: TrackStats[]
  hourlyStats: HourlyStats[]
  dayStats: DayStats[]
  topArtistPerYear: YearArtist[]
  nostalgicArtists: NostalgicArtist[]
  totalEntries: number
  dateRange: { from: string; to: string }
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

type FileFormat = 'spotify' | 'apple-music' | 'youtube-music' | 'amazon-music' | 'unknown'

function detectFormat(filename: string, content: string): FileFormat {
  const name = filename.toLowerCase()
  // Try to detect by filename first
  if (name.includes('streaming_history')) return 'spotify'
  if (name.includes('apple music') || name.includes('play activity')) return 'apple-music'
  if (name.includes('watch-history') || name.includes('watch_history')) return 'youtube-music'
  if (name.includes('amazon music') || name.includes('amazonmusic')) return 'amazon-music'

  // Detect by content
  if (content.includes('master_metadata_track_name')) return 'spotify'
  if (content.includes('Event Start Timestamp') || content.includes('Play Duration Milliseconds')) return 'apple-music'
  if (content.includes('"YouTube Music"') || (content.includes('"header"') && content.includes('"subtitles"'))) return 'youtube-music'
  if (content.includes('Song Name') && content.includes('Date Played')) return 'amazon-music'

  // Try JSON with spotify-like structure
  if (content.trim().startsWith('[') && content.includes('ms_played')) return 'spotify'

  return 'unknown'
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(content: string): Array<Record<string, string>> {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Handle BOM
  const headerLine = lines[0].replace(/^﻿/, '')
  const headers = parseCSVLine(headerLine)

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h.trim()] = (values[i] || '').trim() })
    return row
  }).filter(row => Object.values(row).some(v => v))
}

function parseAppleMusic(content: string): SpotifyEntry[] {
  const rows = parseCSV(content)
  return rows.flatMap(row => {
    const track = row['Song Name'] || row['Track Description'] || row['Title'] || ''
    const artist = row['Artist Name'] || row['Artist'] || ''
    const album = row['Container Name'] || row['Album Name'] || row['Album'] || ''
    const tsRaw = row['Event Start Timestamp'] || row['Play Date'] || row['Date'] || ''
    const msRaw = row['Play Duration Milliseconds'] || row['Duration In Milliseconds'] || ''

    if (!track || !tsRaw) return []

    const ts = new Date(tsRaw).toISOString()
    if (isNaN(new Date(ts).getTime())) return []

    const ms_played = msRaw ? parseInt(msRaw) || 180000 : 180000

    return [{
      ts,
      ms_played,
      master_metadata_track_name: track,
      master_metadata_album_artist_name: artist || null,
      master_metadata_album_album_name: album || null,
    }]
  })
}

function parseYouTubeMusic(content: string): SpotifyEntry[] {
  let parsed: unknown[]
  try { parsed = JSON.parse(content) } catch { return [] }
  if (!Array.isArray(parsed)) return []

  return parsed.flatMap((item: unknown) => {
    const entry = item as Record<string, unknown>
    const isMusic = entry.header === 'YouTube Music' ||
      (Array.isArray(entry.products) && (entry.products as string[]).includes('YouTube Music'))
    if (!isMusic) return []

    const track = typeof entry.title === 'string' ? entry.title : ''
    const subtitles = Array.isArray(entry.subtitles) ? entry.subtitles as Array<Record<string, string>> : []
    const artist = subtitles[0]?.name || ''
    const ts = entry.time ? new Date(entry.time as string).toISOString() : ''
    if (!track || !ts || isNaN(new Date(ts).getTime())) return []

    return [{
      ts,
      ms_played: 180000,
      master_metadata_track_name: track,
      master_metadata_album_artist_name: artist || null,
      master_metadata_album_album_name: null,
    }]
  })
}

function parseDuration(raw: string): number {
  if (!raw) return 180000
  // "M:SS" or "H:MM:SS"
  if (raw.includes(':')) {
    const parts = raw.split(':').map(Number)
    if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000
    if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
  }
  const n = parseInt(raw)
  if (!isNaN(n)) {
    // If large number assume ms, else seconds
    return n > 10000 ? n : n * 1000
  }
  return 180000
}

function parseAmazonMusic(content: string): SpotifyEntry[] {
  const rows = parseCSV(content)
  return rows.flatMap(row => {
    const track = row['Song Name'] || row['Track Name'] || row['Title'] || ''
    const artist = row['Artist Name'] || row['Artist'] || ''
    const album = row['Album Name'] || row['Album'] || ''
    const tsRaw = row['Date Played'] || row['Play Date'] || row['Date'] || ''
    const durRaw = row['Duration'] || row['Play Duration'] || ''

    if (!track || !tsRaw) return []
    const ts = new Date(tsRaw).toISOString()
    if (isNaN(new Date(ts).getTime())) return []

    return [{
      ts,
      ms_played: parseDuration(durRaw),
      master_metadata_track_name: track,
      master_metadata_album_artist_name: artist || null,
      master_metadata_album_album_name: album || null,
    }]
  })
}

export function parseFiles(fileContents: Array<{ name: string; content: string }>): ParsedData {
  const allEntries: SpotifyEntry[] = []

  for (const file of fileContents) {
    const format = detectFormat(file.name, file.content)
    try {
      let entries: SpotifyEntry[] = []
      if (format === 'spotify' || format === 'unknown') {
        // Try JSON parse (Spotify)
        const parsed = JSON.parse(file.content)
        if (Array.isArray(parsed)) entries = parsed as SpotifyEntry[]
      } else if (format === 'apple-music') {
        entries = parseAppleMusic(file.content)
      } else if (format === 'youtube-music') {
        entries = parseYouTubeMusic(file.content)
      } else if (format === 'amazon-music') {
        entries = parseAmazonMusic(file.content)
      }
      allEntries.push(...entries)
    } catch (err) {
      // If JSON parse failed and format was unknown, try CSV
      if (format === 'unknown') {
        try {
          const csvEntries = parseAppleMusic(file.content)
          if (csvEntries.length > 0) allEntries.push(...csvEntries)
        } catch { /* ignore */ }
      }
      console.error(`Failed to parse ${file.name}:`, err)
    }
  }

  // Filter out entries with no track info or too short plays
  const validEntries = allEntries.filter(
    (e) => e.master_metadata_album_artist_name && e.ms_played > 5000
  )

  // Sort by timestamp
  validEntries.sort((a, b) => a.ts.localeCompare(b.ts))

  const dateRange = {
    from: validEntries.length > 0 ? validEntries[0].ts.slice(0, 10) : '',
    to: validEntries.length > 0 ? validEntries[validEntries.length - 1].ts.slice(0, 10) : ''
  }

  // --- Top Artists ---
  const artistMap = new Map<string, ArtistStats>()
  for (const e of validEntries) {
    const artist = e.master_metadata_album_artist_name!
    const existing = artistMap.get(artist)
    if (existing) {
      existing.totalMs += e.ms_played
      existing.playCount++
    } else {
      artistMap.set(artist, { artist, totalMs: e.ms_played, totalMinutes: 0, playCount: 1 })
    }
  }
  const topArtists = Array.from(artistMap.values())
    .map((a) => ({ ...a, totalMinutes: Math.round(a.totalMs / 60000) }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 20)

  // --- Top Tracks ---
  const trackMap = new Map<string, TrackStats>()
  for (const e of validEntries) {
    const key = `${e.master_metadata_track_name}|||${e.master_metadata_album_artist_name}`
    const existing = trackMap.get(key)
    if (existing) {
      existing.totalMs += e.ms_played
      existing.playCount++
    } else {
      trackMap.set(key, {
        track: e.master_metadata_track_name || '不明',
        artist: e.master_metadata_album_artist_name || '不明',
        album: e.master_metadata_album_album_name || '不明',
        totalMs: e.ms_played,
        totalMinutes: 0,
        playCount: 1
      })
    }
  }
  const topTracks = Array.from(trackMap.values())
    .map((t) => ({ ...t, totalMinutes: Math.round(t.totalMs / 60000) }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 20)

  // --- Hourly Stats ---
  const hourMap = new Map<number, HourlyStats>()
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { hour: h, playCount: 0, totalMs: 0 })
  }
  for (const e of validEntries) {
    const hour = new Date(e.ts).getHours()
    const stat = hourMap.get(hour)!
    stat.playCount++
    stat.totalMs += e.ms_played
  }
  const hourlyStats = Array.from(hourMap.values()).sort((a, b) => a.hour - b.hour)

  // --- Day of Week Stats ---
  const dayMap = new Map<number, DayStats>()
  for (let d = 0; d < 7; d++) {
    dayMap.set(d, { day: DAY_NAMES[d], dayIndex: d, playCount: 0, totalMs: 0 })
  }
  for (const e of validEntries) {
    const day = new Date(e.ts).getDay()
    const stat = dayMap.get(day)!
    stat.playCount++
    stat.totalMs += e.ms_played
  }
  const dayStats = Array.from(dayMap.values()).sort((a, b) => a.dayIndex - b.dayIndex)

  // --- Top Artist Per Year ---
  const yearArtistMap = new Map<string, { totalMs: number; playCount: number }>()
  for (const e of validEntries) {
    const year = new Date(e.ts).getFullYear()
    const artist = e.master_metadata_album_artist_name!
    const key = `${year}|||${artist}`
    const existing = yearArtistMap.get(key)
    if (existing) {
      existing.totalMs += e.ms_played
      existing.playCount++
    } else {
      yearArtistMap.set(key, { totalMs: e.ms_played, playCount: 1 })
    }
  }

  const yearTopMap = new Map<number, YearArtist>()
  for (const [key, stats] of yearArtistMap.entries()) {
    const [yearStr, artist] = key.split('|||')
    const year = parseInt(yearStr)
    const existing = yearTopMap.get(year)
    if (!existing || stats.totalMs > existing.totalMs) {
      yearTopMap.set(year, {
        year,
        artist,
        totalMs: stats.totalMs,
        totalMinutes: Math.round(stats.totalMs / 60000)
      })
    }
  }
  const topArtistPerYear = Array.from(yearTopMap.values()).sort((a, b) => b.year - a.year)

  // --- Nostalgic Artists ---
  // Artists with heavy listening pre-2024, zero plays in 2025+
  const artistYearMap = new Map<string, Map<number, number>>()
  for (const e of validEntries) {
    const year = new Date(e.ts).getFullYear()
    const artist = e.master_metadata_album_artist_name!
    if (!artistYearMap.has(artist)) {
      artistYearMap.set(artist, new Map())
    }
    const yearMap = artistYearMap.get(artist)!
    yearMap.set(year, (yearMap.get(year) || 0) + e.ms_played)
  }

  const nostalgicArtists: NostalgicArtist[] = []
  for (const [artist, yearData] of artistYearMap.entries()) {
    let preMs = 0
    let hasPost2024 = false
    let lastYear = 0

    for (const [year, ms] of yearData.entries()) {
      if (year <= 2023) {
        preMs += ms
        if (year > lastYear) lastYear = year
      } else if (year >= 2025) {
        hasPost2024 = true
      }
    }

    if (preMs > 3600000 && !hasPost2024 && lastYear > 0) {
      nostalgicArtists.push({
        artist,
        preMs,
        preMinutes: Math.round(preMs / 60000),
        lastYear
      })
    }
  }
  nostalgicArtists.sort((a, b) => b.preMs - a.preMs)

  return {
    entries: validEntries,
    topArtists,
    topTracks,
    hourlyStats,
    dayStats,
    topArtistPerYear,
    nostalgicArtists: nostalgicArtists.slice(0, 20),
    totalEntries: validEntries.length,
    dateRange
  }
}

export function buildListeningProfile(data: ParsedData): string {
  const top15Artists = data.topArtists
    .slice(0, 15)
    .map((a, i) => `${i + 1}. ${a.artist} (${a.totalMinutes}分)`)
    .join('\n')

  const top10Tracks = data.topTracks
    .slice(0, 10)
    .map((t, i) => `${i + 1}. "${t.track}" by ${t.artist} (${t.playCount}回)`)
    .join('\n')

  // Determine peak listening hours
  const sorted = [...data.hourlyStats].sort((a, b) => b.playCount - a.playCount)
  const top3Hours = sorted
    .slice(0, 3)
    .map((h) => `${h.hour}時台`)
    .join(', ')

  const peakDay = [...data.dayStats].sort((a, b) => b.playCount - a.playCount)[0]

  return `【リスニングプロフィール】

■ よく聴くアーティスト（再生時間順）：
${top15Artists}

■ よく聴く曲（上位10曲）：
${top10Tracks}

■ よく聴く時間帯：${top3Hours}
■ よく聴く曜日：${peakDay?.day}曜日
■ データ期間：${data.dateRange.from} 〜 ${data.dateRange.to}
■ 総再生記録数：${data.totalEntries.toLocaleString()}件`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) return `${hours}時間${mins > 0 ? mins + '分' : ''}`
  const days = Math.floor(hours / 24)
  const hrs = hours % 24
  return `${days}日${hrs > 0 ? hrs + '時間' : ''}`
}
