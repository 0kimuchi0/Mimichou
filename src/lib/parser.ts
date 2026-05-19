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

export function parseFiles(fileContents: Array<{ name: string; content: string }>): ParsedData {
  const allEntries: SpotifyEntry[] = []

  for (const file of fileContents) {
    try {
      const parsed = JSON.parse(file.content)
      if (Array.isArray(parsed)) {
        allEntries.push(...(parsed as SpotifyEntry[]))
      }
    } catch (err) {
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
