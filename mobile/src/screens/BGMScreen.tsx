import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppContext } from '../../App'
import { claudeChatStream, BGM_SYSTEM_PROMPT } from '../lib/claude'

const C = {
  bg: '#1a1a2e',
  surface: '#16213e',
  border: 'rgba(192,57,43,0.25)',
  accent: '#c0392b',
  text: '#f5f0e8',
  textMuted: 'rgba(245,240,232,0.55)',
  textDim: 'rgba(245,240,232,0.3)',
}

const MOOD_PRESETS = [
  '集中したい', 'リラックス', 'テンション上げたい', '眠れない',
  '感傷的な気分', '朝のスタート', '落ち込んでいる', 'ドライブ中',
]

const TIME_OPTIONS = ['早朝', '午前', '昼', '午後', '夕方', '夜', '深夜']

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

export function BGMScreen() {
  const { listeningProfile } = useAppContext()
  const [mood, setMood] = useState('')
  const [timeOfDay, setTimeOfDay] = useState(getCurrentTimeLabel())
  const [situation, setSituation] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [resultText, setResultText] = useState('')
  const [artists, setArtists] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [timePickerOpen, setTimePickerOpen] = useState(false)

  async function generate() {
    if (streaming) return
    setError(null)
    setResultText('')
    setArtists([])
    setStreaming(true)

    const userMessage = [
      `気分: ${mood || '特になし'}`,
      `時間帯: ${timeOfDay}`,
      situation ? `状況: ${situation}` : null,
    ].filter(Boolean).join('\n')

    const systemPrompt = BGM_SYSTEM_PROMPT(listeningProfile)
    let buffer = ''

    try {
      for await (const chunk of claudeChatStream(
        [{ role: 'user', content: userMessage }],
        systemPrompt
      )) {
        buffer += chunk
        setResultText(buffer)
      }
      setArtists(extractArtists(buffer))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setStreaming(false)
    }
  }

  function openSpotify(artist: string) {
    Linking.openURL(`https://open.spotify.com/search/${encodeURIComponent(artist)}`)
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BGM セレクター</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Mood */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>今の気分</Text>
          <View style={styles.presetRow}>
            {MOOD_PRESETS.map(preset => (
              <TouchableOpacity
                key={preset}
                style={[styles.presetBtn, mood === preset && styles.presetBtnActive]}
                onPress={() => setMood(mood === preset ? '' : preset)}
              >
                <Text style={[styles.presetBtnText, mood === preset && styles.presetBtnTextActive]}>
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.textInput}
            value={mood}
            onChangeText={setMood}
            placeholder="または自由に入力（例: 雨の日に合う音楽）"
            placeholderTextColor={C.textDim}
          />
        </View>

        {/* Time */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>時間帯</Text>
          <View style={styles.timeRow}>
            <TouchableOpacity
              style={styles.timeSelector}
              onPress={() => setTimePickerOpen(!timePickerOpen)}
            >
              <Text style={styles.timeSelectorText}>{timeOfDay}</Text>
              <Text style={styles.timeSelectorChevron}>▾</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.autoBtn}
              onPress={() => setTimeOfDay(getCurrentTimeLabel())}
            >
              <Text style={styles.autoBtnText}>現在時刻</Text>
            </TouchableOpacity>
          </View>
          {timePickerOpen && (
            <View style={styles.timePicker}>
              {TIME_OPTIONS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.timeOption, timeOfDay === t && styles.timeOptionActive]}
                  onPress={() => { setTimeOfDay(t); setTimePickerOpen(false) }}
                >
                  <Text style={[styles.timeOptionText, timeOfDay === t && styles.timeOptionTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Situation */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>シチュエーション（任意）</Text>
          <TextInput
            style={styles.textInput}
            value={situation}
            onChangeText={setSituation}
            placeholder="例: 在宅ワーク中、ドライブ、読書しながら"
            placeholderTextColor={C.textDim}
          />
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateBtn, streaming && styles.generateBtnDisabled]}
          onPress={generate}
          disabled={streaming}
        >
          {streaming ? (
            <View style={styles.generateBtnRow}>
              <ActivityIndicator color={C.text} size="small" />
              <Text style={styles.generateBtnText}>提案中...</Text>
            </View>
          ) : (
            <Text style={styles.generateBtnText}>BGMを提案してもらう</Text>
          )}
        </TouchableOpacity>

        {error && (
          <Text style={styles.errorText}>エラー: {error}</Text>
        )}

        {resultText !== '' && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>AIの提案</Text>
            <Text style={styles.resultText}>{resultText}</Text>

            {artists.length > 0 && (
              <>
                <Text style={styles.spotifyLabel}>Spotifyで検索:</Text>
                <View style={styles.artistGrid}>
                  {artists.map((artist, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.artistTag}
                      onPress={() => openSpotify(artist)}
                    >
                      <Text style={styles.artistName}>{artist}</Text>
                      <View style={styles.spotifyBadge}>
                        <Text style={styles.spotifyBadgeText}>▶</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}
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
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  presetBtnActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  presetBtnText: {
    fontSize: 13,
    color: C.textMuted,
  },
  presetBtnTextActive: {
    color: C.text,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    color: C.text,
    fontSize: 14,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  timeSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
  },
  timeSelectorText: {
    color: C.text,
    fontSize: 14,
  },
  timeSelectorChevron: {
    color: C.textDim,
    fontSize: 12,
  },
  autoBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  autoBtnText: {
    color: C.textMuted,
    fontSize: 12,
  },
  timePicker: {
    marginTop: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  timeOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(192,57,43,0.1)',
  },
  timeOptionActive: {
    backgroundColor: 'rgba(192,57,43,0.15)',
  },
  timeOptionText: {
    fontSize: 14,
    color: C.textMuted,
  },
  timeOptionTextActive: {
    color: C.text,
    fontWeight: '600',
  },
  generateBtn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  generateBtnText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorText: {
    color: C.accent,
    fontSize: 13,
    marginBottom: 12,
  },
  resultCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    color: C.text,
    lineHeight: 22,
  },
  spotifyLabel: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 16,
    marginBottom: 10,
  },
  artistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  artistTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(192,57,43,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(192,57,43,0.4)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
  },
  artistName: {
    fontSize: 13,
    color: C.text,
  },
  spotifyBadge: {
    backgroundColor: '#1DB954',
    borderRadius: 10,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
})
