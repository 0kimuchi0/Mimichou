import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // File dialog
  openFiles: (): Promise<Array<{ name: string; content: string }>> =>
    ipcRenderer.invoke('dialog:openFiles'),

  // Claude chat (non-streaming)
  claudeChat: (
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string
  ): Promise<{ success: boolean; content?: string; error?: string }> =>
    ipcRenderer.invoke('claude:chat', messages, systemPrompt),

  // Claude streaming
  claudeChatStream: (
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('claude:chatStream', messages, systemPrompt),

  onStreamChunk: (callback: (text: string) => void) => {
    ipcRenderer.on('claude:streamChunk', (_event, text) => callback(text))
  },

  onStreamEnd: (callback: () => void) => {
    ipcRenderer.on('claude:streamEnd', () => callback())
  },

  onStreamError: (callback: (error: string) => void) => {
    ipcRenderer.on('claude:streamError', (_event, error) => callback(error))
  },

  removeStreamListeners: () => {
    ipcRenderer.removeAllListeners('claude:streamChunk')
    ipcRenderer.removeAllListeners('claude:streamEnd')
    ipcRenderer.removeAllListeners('claude:streamError')
  }
})
