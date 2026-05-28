const REDIRECT_URI = window.location.origin + '/'

// ---- Shared helpers ----

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

async function pkceStart(stateKey: string, verifierKey: string): Promise<{ challenge: string; state: string }> {
  const verifier = randomString(64)
  const challenge = base64urlEncode(await sha256(verifier))
  const state = randomString(16)
  sessionStorage.setItem(verifierKey, verifier)
  sessionStorage.setItem(stateKey, state)
  return { challenge, state }
}

export type Provider = 'spotify' | 'google'

export interface AuthUser {
  id: string           // provider-prefixed: "spotify_xxx" or "google_xxx"
  display_name: string
  image_url: string | null
  provider: Provider
}

const TOKEN_KEY = 'mimichou_token'
const USER_KEY  = 'mimichou_user'

// ---- Spotify ----

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || ''

export async function startSpotifyLogin(): Promise<void> {
  const { challenge, state } = await pkceStart('pkce_state', 'pkce_verifier')
  sessionStorage.setItem('pkce_provider', 'spotify')
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: 'user-read-private user-read-email',
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

async function handleSpotifyCallback(code: string, verifier: string): Promise<AuthUser | null> {
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
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
  const u = await userRes.json()

  const user: AuthUser = {
    id: `spotify_${u.id}`,
    display_name: u.display_name || u.id,
    image_url: u.images?.[0]?.url ?? null,
    provider: 'spotify',
  }
  localStorage.setItem(TOKEN_KEY, `spotify:${access_token}`)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

// ---- Google ----

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export async function startGoogleLogin(): Promise<void> {
  const { challenge, state } = await pkceStart('pkce_state', 'pkce_verifier')
  sessionStorage.setItem('pkce_provider', 'google')
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: 'openid email profile',
    access_type: 'online',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

async function handleGoogleCallback(code: string, verifier: string): Promise<AuthUser | null> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  })
  if (!tokenRes.ok) return null
  const { access_token } = await tokenRes.json()

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!userRes.ok) return null
  const u = await userRes.json()

  const user: AuthUser = {
    id: `google_${u.sub}`,
    display_name: u.name || u.email,
    image_url: u.picture ?? null,
    provider: 'google',
  }
  localStorage.setItem(TOKEN_KEY, `google:${access_token}`)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

// ---- Common callback handler ----

export async function handleOAuthCallback(): Promise<AuthUser | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const storedState = sessionStorage.getItem('pkce_state')
  const verifier = sessionStorage.getItem('pkce_verifier')
  const provider = sessionStorage.getItem('pkce_provider') as Provider | null

  if (!code || state !== storedState || !verifier || !provider) return null

  window.history.replaceState({}, '', '/')
  sessionStorage.removeItem('pkce_verifier')
  sessionStorage.removeItem('pkce_state')
  sessionStorage.removeItem('pkce_provider')

  if (provider === 'spotify') return handleSpotifyCallback(code, verifier)
  if (provider === 'google')  return handleGoogleCallback(code, verifier)
  return null
}

// ---- Storage helpers ----

export function getStoredUser(): AuthUser | null {
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
