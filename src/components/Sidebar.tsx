import React from 'react'
import { startSpotifyLogin, startGoogleLogin, type AuthUser } from '../lib/auth'

type Tab = 'history' | 'recommend' | 'bgm'

interface SidebarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  hasData: boolean
  user: AuthUser | null
  onLogout: () => void
}

const IconHistory = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M12 7v5l4 2"/>
  </svg>
)

const IconRecommend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <path d="M12 17h.01"/>
  </svg>
)

const IconBGM = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
)

const SpotifyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
)

const GoogleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const tabs: Array<{ id: Tab; Icon: React.FC; label: string; sublabel: string }> = [
  { id: 'history', Icon: IconHistory, label: '音歴', sublabel: 'History' },
  { id: 'recommend', Icon: IconRecommend, label: '推薦', sublabel: 'Recommend' },
  { id: 'bgm', Icon: IconBGM, label: 'BGM', sublabel: 'Now Playing' }
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
    fontFamily: '"Hiragino Mincho ProN", "YuMincho", "Yu Mincho", Georgia, serif'
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
    fontFamily: '"Hiragino Mincho ProN", "YuMincho", "Yu Mincho", Georgia, serif',
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
    padding: '12px',
    borderTop: '1px solid rgba(192, 57, 43, 0.2)',
  },
  footerText: {
    fontSize: '10px',
    color: 'rgba(245, 240, 232, 0.25)',
    letterSpacing: '0.1em',
    textAlign: 'center',
    marginBottom: '10px'
  },
  loginBtn: {
    width: '100%',
    background: '#1DB954',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 10px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  userCard: {
    background: 'rgba(245,240,232,0.06)',
    borderRadius: '8px',
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  userAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(192,57,43,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  userName: {
    fontSize: '12px',
    color: '#f5f0e8',
    fontWeight: '600',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(245,240,232,0.3)',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0',
    lineHeight: 1,
  }
}

export function Sidebar({ activeTab, onTabChange, hasData, user, onLogout }: SidebarProps) {
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
              <span style={{ ...styles.tabIcon, color: isActive ? '#f5f0e8' : 'rgba(245,240,232,0.5)' }}><tab.Icon /></span>
              <span style={styles.tabText}>
                <span style={{ ...styles.tabLabel, color: isActive ? '#f5f0e8' : 'rgba(245, 240, 232, 0.6)' }}>
                  {tab.label}
                </span>
                <span style={{ ...styles.tabSublabel, color: isActive ? 'rgba(192, 57, 43, 0.8)' : 'rgba(245, 240, 232, 0.3)' }}>
                  {tab.sublabel}
                </span>
              </span>
            </button>
          )
        })}
      </nav>

      <div style={styles.footer}>
        <p style={styles.footerText}>音楽 × Claude</p>

        {user ? (
          <div style={styles.userCard}>
            <div style={styles.userAvatar}>
              {user.image_url ? (
                <img src={user.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '12px', color: '#f5f0e8', fontWeight: '700' }}>
                  {user.display_name[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <span style={styles.userName}>{user.display_name}</span>
            <button style={styles.logoutBtn} onClick={onLogout} title="ログアウト">×</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button style={styles.loginBtn} onClick={startSpotifyLogin}>
              <SpotifyIcon />
              Spotifyでログイン
            </button>
            <button
              style={{ ...styles.loginBtn, background: '#fff', color: '#333', border: '1px solid rgba(255,255,255,0.15)' }}
              onClick={startGoogleLogin}
            >
              <GoogleIcon />
              Googleでログイン
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
