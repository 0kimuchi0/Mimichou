import React, { useState, createContext, useContext, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { History } from './tabs/History'
import { Recommend } from './tabs/Recommend'
import { BGM } from './tabs/BGM'
import type { ParsedData } from './lib/parser'
import { handleOAuthCallback, getStoredUser, getStoredToken, logout, type AuthUser } from './lib/auth'

type Tab = 'history' | 'recommend' | 'bgm'

interface AppContextType {
  parsedData: ParsedData | null
  setParsedData: (data: ParsedData | null) => void
  listeningProfile: string
  setListeningProfile: (profile: string) => void
  user: AuthUser | null
  token: string | null
  onLogout: () => void
}

export const AppContext = createContext<AppContextType>({
  parsedData: null,
  setParsedData: () => {},
  listeningProfile: '',
  setListeningProfile: () => {},
  user: null,
  token: null,
  onLogout: () => {},
})

export function useAppContext() {
  return useContext(AppContext)
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#1a1a2e'
  },
  mainContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('history')
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [listeningProfile, setListeningProfile] = useState<string>('')
  const [user, setUser] = useState<AuthUser | null>(getStoredUser)
  const [token, setToken] = useState<string | null>(getStoredToken)

  // Handle Spotify OAuth callback
  useEffect(() => {
    if (!window.location.search.includes('code=')) return
    handleOAuthCallback().then(u => {
      if (u) {
        setUser(u)
        setToken(getStoredToken())
      }
    })
  }, [])

  function onLogout() {
    logout()
    setUser(null)
    setToken(null)
  }

  return (
    <AppContext.Provider value={{ parsedData, setParsedData, listeningProfile, setListeningProfile, user, token, onLogout }}>
      <div style={styles.container}>
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasData={parsedData !== null}
          user={user}
          onLogout={onLogout}
        />
        <main style={styles.mainContent}>
          {activeTab === 'history' && <History />}
          {activeTab === 'recommend' && <Recommend />}
          {activeTab === 'bgm' && <BGM />}
        </main>
      </div>
    </AppContext.Provider>
  )
}
