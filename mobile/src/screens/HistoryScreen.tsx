import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppContext } from '../../App'
import { parseFiles, buildListeningProfile } from '../lib/parser'
import type { ParsedData, ArtistStats, TrackStats } from '../lib/parser'

const C = {
  bg: '#1a1a2e',
  surface: '#16213e',
  surface2: '#1e2a4a',
  border: 'rgba(192,57,43,0.25)',
  accent: '#c0392b',
  text: '#f5f0e8',
  textMuted: 'rgba(245,240,232,0.55)',
  textDim: 'rgba(245,240,232,0.3)',
  barFill: '#c0392b',
  barBg: 'rgba(192,57,43,0.15)',
}

function Bar({ ratio, maxWidth }: { ratio: number; maxWidth: number }) {
  return (
    <View style={[styles.barBg, { width: maxWidth }]}>
      <View style={[styles.barFill, { width: maxWidth * ratio }]} />
    </View>
  )
}

function ArtistRow({ artist, rank, maxMs }: { artist: ArtistStats; rank: number; maxMs: number }) {
  return (
    <View style={styles.rankRow}>
      <Text style={styles.rankNum}>{rank}</Text>
      <View style={styles.rankContent}>
        <Text style={styles.rankName} numberOfLines={1}>{artist.artist}</Text>
        <View style={styles.rankMeta}>
          <Bar ratio={artist.totalMs / maxMs} maxWidth={140} />
          <Text style={styles.rankStat}>{artist.totalMinutes}分</Text>
        </View>
      </View>
    </View>
  )
}

function TrackRow({ track, rank, maxMs }: { track: TrackStats; rank: number; maxMs: number }) {
  return (
    <View style={styles.rankRow}>
      <Text style={styles.rankNum}>{rank}</Text>
      <View style={styles.rankContent}>
        <Text style={styles.rankName} numberOfLines={1}>{track.track}</Text>
        <Text style={styles.rankSub} numberOfLines={1}>{track.artist}</Text>
        <View style={styles.rankMeta}>
          <Bar ratio={track.totalMs / maxMs} maxWidth={120} />
          <Text style={styles.rankStat}>{track.playCount}回</Text>
        </View>
      </View>
    </View>
  )
}

function HourChart({ data }: { data: ParsedData['hourlyStats'] }) {
  const max = Math.max(...data.map(d => d.playCount), 1)
  return (
    <View style={styles.hourChart}>
      {data.map(h => (
        <View key={h.hour} style={styles.hourCol}>
          <View style={styles.hourBarContainer}>
            <View style={[styles.hourBar, { height: Math.max(4, (h.playCount / max) * 60) }]} />
          </View>
          {h.hour % 6 === 0 && (
            <Text style={styles.hourLabel}>{h.hour}</Text>
          )}
        </View>
      ))}
    </View>
  )
}

function DataView({ data }: { data: ParsedData }) {
  const [tab, setTab] = useState<'artists' | 'tracks' | 'time'>('artists')
  const maxArtistMs = data.topArtists[0]?.totalMs || 1
  const maxTrackMs = data.topTracks[0]?.totalMs || 1

  return (
    <View style={styles.dataContainer}>
      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{data.totalEntries.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>総再生数</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{data.topArtists.length}</Text>
          <Text style={styles.summaryLabel}>アーティスト</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{data.dateRange.from.slice(0, 4)}</Text>
          <Text style={styles.summaryLabel}>開始年</Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {(['artists', 'tracks', 'time'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === 'artists' ? 'アーティスト' : t === 'tracks' ? '曲' : '時間帯'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'artists' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>よく聴くアーティスト</Text>
          {data.topArtists.slice(0, 15).map((a, i) => (
            <ArtistRow key={a.artist} artist={a} rank={i + 1} maxMs={maxArtistMs} />
          ))}
        </View>
      )}

      {tab === 'tracks' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>よく聴く曲</Text>
          {data.topTracks.slice(0, 15).map((t, i) => (
            <TrackRow key={`${t.track}-${t.artist}`} track={t} rank={i + 1} maxMs={maxTrackMs} />
          ))}
        </View>
      )}

      {tab === 'time' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>時間帯別再生数</Text>
          <HourChart data={data.hourlyStats} />
          <View style={styles.dayRow}>
            {data.dayStats.map(d => (
              <View key={d.day} style={styles.dayItem}>
                <Text style={styles.dayLabel}>{d.day}</Text>
                <Text style={styles.dayCount}>{d.playCount}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

export function HistoryScreen() {
  const { parsedData, setParsedData, setListeningProfile } = useAppContext()
  const [loading, setLoading] = useState(false)

  async function pickFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/csv', 'text/comma-separated-values', '*/*'],
        multiple: true,
        copyToCacheDirectory: true,
      })

      if (result.canceled) return

      setLoading(true)
      const fileContents: Array<{ name: string; content: string }> = []

      for (const asset of result.assets) {
        const content = await FileSystem.readAsStringAsync(asset.uri)
        fileContents.push({ name: asset.name, content })
      }

      const parsed = parseFiles(fileContents)

      if (parsed.totalEntries === 0) {
        Alert.alert('読み込めませんでした', '対応しているファイル形式か確認してください。\n対応: Spotify JSON, Apple Music CSV, YouTube Music JSON, Amazon Music CSV')
        setLoading(false)
        return
      }

      const profile = buildListeningProfile(parsed)
      setParsedData(parsed)
      setListeningProfile(profile)
    } catch (err) {
      Alert.alert('エラー', String(err))
    } finally {
      setLoading(false)
    }
  }

  function openSpotifyExport() {
    Linking.openURL('https://www.spotify.com/account/privacy/')
  }

  if (parsedData) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>音歴</Text>
          <TouchableOpacity style={styles.reloadBtn} onPress={pickFiles}>
            <Text style={styles.reloadBtnText}>再読込</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <DataView data={parsedData} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>音歴</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.emptyContent}>
        <Text style={styles.appName}>耳帖</Text>
        <Text style={styles.appDesc}>音楽履歴をAIで分析</Text>

        {/* File Upload Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ファイルから読み込む</Text>
          <Text style={styles.cardDesc}>
            Spotify・Apple Music・YouTube Music・Amazon Musicのデータエクスポートファイルに対応しています。
          </Text>

          <View style={styles.serviceList}>
            {[
              { name: 'Spotify', hint: 'アカウント設定 → プライバシー → データのダウンロード' },
              { name: 'Apple Music', hint: 'privacy.apple.com → データを取得' },
              { name: 'YouTube Music', hint: 'Google Takeout → YouTube Music の履歴' },
              { name: 'Amazon Music', hint: 'Amazon Music設定 → データのエクスポート' },
            ].map(s => (
              <View key={s.name} style={styles.serviceRow}>
                <View style={styles.serviceDot} />
                <View>
                  <Text style={styles.serviceName}>{s.name}</Text>
                  <Text style={styles.serviceHint}>{s.hint}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={pickFiles}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.text} />
            ) : (
              <Text style={styles.primaryBtnText}>ファイルを選択する</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Spotify link shortcut */}
        <TouchableOpacity style={styles.linkRow} onPress={openSpotifyExport}>
          <Text style={styles.linkText}>Spotifyデータエクスポートページを開く</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 1,
  },
  reloadBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reloadBtnText: {
    color: C.textMuted,
    fontSize: 12,
  },
  scroll: {
    flex: 1,
  },
  emptyContent: {
    padding: 20,
    alignItems: 'center',
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: C.text,
    marginTop: 20,
    marginBottom: 4,
    letterSpacing: 2,
  },
  appDesc: {
    fontSize: 14,
    color: C.textMuted,
    marginBottom: 32,
    letterSpacing: 1,
  },
  card: {
    width: '100%',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginBottom: 10,
  },
  cardDesc: {
    fontSize: 13,
    color: C.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  serviceList: {
    marginBottom: 20,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  serviceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
    marginTop: 6,
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
  },
  serviceHint: {
    fontSize: 11,
    color: C.textDim,
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  linkRow: {
    paddingVertical: 12,
  },
  linkText: {
    color: C.accent,
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  // Data view
  dataContainer: {
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  summaryNum: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
  },
  summaryLabel: {
    fontSize: 10,
    color: C.textDim,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(192,57,43,0.2)',
    borderColor: C.accent,
  },
  tabBtnText: {
    fontSize: 12,
    color: C.textMuted,
  },
  tabBtnTextActive: {
    color: C.text,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  rankNum: {
    width: 24,
    fontSize: 12,
    color: C.textDim,
    textAlign: 'right',
    marginTop: 2,
  },
  rankContent: {
    flex: 1,
  },
  rankName: {
    fontSize: 14,
    color: C.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  rankSub: {
    fontSize: 11,
    color: C.textMuted,
    marginBottom: 4,
  },
  rankMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankStat: {
    fontSize: 11,
    color: C.textDim,
  },
  barBg: {
    height: 4,
    backgroundColor: C.barBg,
    borderRadius: 2,
  },
  barFill: {
    height: 4,
    backgroundColor: C.barFill,
    borderRadius: 2,
  },

  // Hour chart
  hourChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    marginBottom: 16,
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  hourCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  hourBarContainer: {
    justifyContent: 'flex-end',
    height: 60,
  },
  hourBar: {
    width: 6,
    backgroundColor: C.accent,
    borderRadius: 2,
  },
  hourLabel: {
    fontSize: 8,
    color: C.textDim,
    marginTop: 2,
  },

  // Day stats
  dayRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  dayItem: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 12,
    color: C.textMuted,
    marginBottom: 4,
  },
  dayCount: {
    fontSize: 11,
    color: C.textDim,
  },
})
