import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppContext } from '../../App'
import { claudeChatStream, RECOMMEND_SYSTEM_PROMPT } from '../lib/claude'
import type { Message } from '../lib/claude'

const C = {
  bg: '#1a1a2e',
  surface: '#16213e',
  border: 'rgba(192,57,43,0.25)',
  accent: '#c0392b',
  text: '#f5f0e8',
  textMuted: 'rgba(245,240,232,0.55)',
  textDim: 'rgba(245,240,232,0.3)',
}

export function RecommendScreen() {
  const { listeningProfile } = useAppContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (messages.length === 0 && listeningProfile) {
      setMessages([{
        role: 'assistant',
        content: 'こんにちは！あなたのリスニング履歴を拝見しました。\nアルバムの推薦をご希望ですか？「おすすめのアルバムを教えて」と入力するか、「もっとアップテンポで」など具体的なリクエストもどうぞ。',
      }])
    }
  }, [listeningProfile])

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true })
  }, [messages])

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
          content: `エラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>アルバム推薦</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, i) => (
            <View
              key={i}
              style={[
                styles.bubbleRow,
                msg.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                ]}
              >
                {msg.content === '' && streaming && i === messages.length - 1 ? (
                  <ActivityIndicator size="small" color={C.textMuted} />
                ) : (
                  <Text style={styles.bubbleText}>{msg.content}</Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="メッセージを入力..."
            placeholderTextColor={C.textDim}
            multiline
            maxLength={500}
            editable={!streaming}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (streaming || !input.trim()) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={streaming || !input.trim()}
          >
            <Text style={styles.sendBtnText}>送信</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  flex: {
    flex: 1,
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
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    padding: 12,
    minHeight: 36,
  },
  bubbleUser: {
    backgroundColor: C.accent,
  },
  bubbleAssistant: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleText: {
    fontSize: 14,
    color: C.text,
    lineHeight: 21,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
    color: C.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignSelf: 'flex-end',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: C.text,
    fontWeight: '700',
    fontSize: 14,
  },
})
