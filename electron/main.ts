import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import * as dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'

// Load .env from project root
dotenv.config({ path: join(app.getAppPath(), '.env') })
// Also try one level up for dev
dotenv.config({ path: join(process.cwd(), '.env') })

let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Please create a .env file with your API key.')
    }
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC: Open file dialog
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ],
    title: 'Spotify 音楽履歴ファイルを選択'
  })
  if (result.canceled) return []

  const fileContents: Array<{ name: string; content: string }> = []
  for (const filePath of result.filePaths) {
    try {
      const content = readFileSync(filePath, 'utf-8')
      fileContents.push({ name: filePath, content })
    } catch (err) {
      console.error(`Failed to read ${filePath}:`, err)
    }
  }
  return fileContents
})

// IPC: Claude chat (non-streaming)
ipcMain.handle('claude:chat', async (_event, messages: Array<{ role: string; content: string }>, systemPrompt: string) => {
  try {
    const client = getAnthropicClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages as Anthropic.MessageParam[]
    })
    const block = response.content[0]
    return { success: true, content: block.type === 'text' ? block.text : '' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
})

// IPC: Claude chat streaming
ipcMain.handle('claude:chatStream', async (event, messages: Array<{ role: string; content: string }>, systemPrompt: string) => {
  try {
    const client = getAnthropicClient()
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages as Anthropic.MessageParam[]
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        event.sender.send('claude:streamChunk', chunk.delta.text)
      }
    }

    event.sender.send('claude:streamEnd')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    event.sender.send('claude:streamError', message)
    return { success: false, error: message }
  }
})
