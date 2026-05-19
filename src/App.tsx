import React, { useState, createContext, useContext } from 'react'
import { Sidebar } from './components/Sidebar'
import { History } from './tabs/History'
import { Recommend } from './tabs/Recommend'
import { BGM } from './tabs/BGM'
import type { ParsedData } from './lib/parser'

type Tab = 'history' | 'recommend' | 'bgm'

interface AppContextType {
  parsedData: ParsedData | null
  setParsedData: (data: ParsedData | null) => void
  listeningProfile: string
  setListeningProfile: (profile: string) => void
}

export const AppContext = createContext<AppContextType>({
  parsedData: null,
  setParsedData: () => {},
  listeningProfile: '',
  setListeningProfile: () => {}
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

  return (
    <AppContext.Provider value={{ parsedData, setParsedData, listeningProfile, setListeningProfile }}>
      <div style={styles.container}>
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasData={parsedData !== null}
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
