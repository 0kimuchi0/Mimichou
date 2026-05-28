const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || ''
const REDIRECT_URI = window.location.origin + '/'
const SCOPES = 'user-read-private user-read-email'

const TOKEN_KEY = 'mimichou_spotify_token'
const USER_KEY = 'mimichou_spotify_user'

export interface SpotifyUser {
  id: string
  display_name: string
  image_url: string | null
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain))
}

function base64urlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => chars[b % chars.length]).join('')
}

export async function startSpotifyLogin(): Promise<void> {
  const verifier = randomString(64)
  const challenge = base64urlEncode(await sha256(verifier))
  const state = randomString(16)

  sessionStorage.setItem('pkce_verifier', verifier)
  sessionStorage.setItem('pkce_state', state)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SCOPES,
  })

  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function handleOAuthCallback(): Promise<SpotifyUser | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const storedState = sessionStorage.getItem('pkce_state')
  const verifier = sessionStorage.getItem('pkce_verifier')

  if (!code || state !== storedState || !verifier) return null

  window.history.replaceState({}, '', '/')
  sessionStorage.removeItem('pkce_verifier')
  sessionStorage.removeItem('pkce_state')

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  })

  if (!tokenRes.ok) return null
  const { access_token } = await tokenRes.json()

  const userRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!userRes.ok) return null
  const userData = await userRes.json()

  const user: SpotifyUser = {
    id: userData.id,
    display_name: userData.display_name || userData.id,
    image_url: userData.images?.[0]?.url ?? null,
  }

  localStorage.setItem(TOKEN_KEY, access_token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

export function getStoredUser(): SpotifyUser | null {
  try {
    const s = localStorage.getItem(USER_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
