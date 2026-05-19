import React from 'react'

type Tab = 'history' | 'recommend' | 'bgm'

interface SidebarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  hasData: boolean
}

const tabs: Array<{ id: Tab; icon: string; label: string; sublabel: string }> = [
  { id: 'history', icon: '📜', label: '音歴', sublabel: 'History' },
  { id: 'recommend', icon: '🎵', label: '推薦', sublabel: 'Recommend' },
  { id: 'bgm', icon: '🎧', label: 'BGM', sublabel: 'Now Playing' }
]

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: '200px',
    minWidth: '200px',
    background: 'linear-gradient(180deg, #12122a 0%, #0e0e1f 100%)',
    borderRight: '1px solid rgba(192, 57, 43, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    userSelect: 'none'
  },
  header: {
    padding: '24px 16px 20px',
    borderBottom: '1px solid rgba(192, 57, 43, 0.2)',
    textAlign: 'center'
  },
  appTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f5f0e8',
    letterSpacing: '0.05em',
    margin: '0 0 2px',
    fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", Georgia, serif'
  },
  appSubtitle: {
    fontSize: '11px',
    color: 'rgba(245, 240, 232, 0.4)',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    margin: 0
  },
  nav: {
    flex: 1,
    padding: '12px 0'
  },
  tabButton: {
    width: '100%',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'all 0.2s ease',
    position: 'relative',
    textAlign: 'left'
  },
  tabIcon: {
    fontSize: '18px',
    width: '28px',
    textAlign: 'center',
    flexShrink: 0
  },
  tabText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px'
  },
  tabLabel: {
    fontSize: '15px',
    fontWeight: '600',
    fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", Georgia, serif',
    letterSpacing: '0.05em',
    lineHeight: 1
  },
  tabSublabel: {
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    lineHeight: 1
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: '3px',
    height: '60%',
    background: '#c0392b',
    borderRadius: '0 2px 2px 0'
  },
  footer: {
    padding: '16px',
    borderTop: '1px solid rgba(192, 57, 43, 0.2)',
    textAlign: 'center'
  },
  footerText: {
    fontSize: '10px',
    color: 'rgba(245, 240, 232, 0.25)',
    letterSpacing: '0.1em'
  }
}

export function Sidebar({ activeTab, onTabChange, hasData }: SidebarProps) {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.header}>
        <h1 style={styles.appTitle}>耳帖</h1>
        <p style={styles.appSubtitle}>Mimichou</p>
      </div>

      <nav style={styles.nav}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const isDisabled = (tab.id === 'recommend' || tab.id === 'bgm') && !hasData

          return (
            <button
              key={tab.id}
              style={{
                ...styles.tabButton,
                opacity: isDisabled ? 0.4 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                background: isActive
                  ? 'linear-gradient(90deg, rgba(192, 57, 43, 0.15) 0%, transparent 100%)'
                  : 'none'
              }}
              onClick={() => !isDisabled && onTabChange(tab.id)}
              disabled={isDisabled}
              title={isDisabled ? '音歴データを読み込んでください' : undefined}
            >
              {isActive && <div style={styles.activeIndicator} />}
              <span style={styles.tabIcon}>{tab.icon}</span>
              <span style={styles.tabText}>
                <span
                  style={{
                    ...styles.tabLabel,
                    color: isActive ? '#f5f0e8' : 'rgba(245, 240, 232, 0.6)'
                  }}
                >
                  {tab.label}
                </span>
                <span
                  style={{
                    ...styles.tabSublabel,
                    color: isActive ? 'rgba(192, 57, 43, 0.8)' : 'rgba(245, 240, 232, 0.3)'
                  }}
                >
                  {tab.sublabel}
                </span>
              </span>
            </button>
          )
        })}
      </nav>

      <div style={styles.footer}>
        <p style={styles.footerText}>Spotify × Claude</p>
      </div>
    </aside>
  )
}
