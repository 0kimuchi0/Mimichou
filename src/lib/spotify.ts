const SPOTIFY_SCOPES = 'user-read-recently-played'

function getRedirectUri(): string {
  return window.location.origin + '/'
}

// PKCE helpers
async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(64)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function getClientId(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (import.meta as any).env?.VITE_SPOTIFY_CLIENT_ID || ''
}

export async function startSpotifyLogin(): Promise<void> {
  const clientId = getClientId()
  if (!clientId) throw new Error('VITE_SPOTIFY_CLIENT_ID が設定されていません')

  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem('spotify_code_verifier', verifier)

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function handleOAuthCallback(code: string): Promise<string> {
  const clientId = getClientId()
  const verifier = sessionStorage.getItem('spotify_code_verifier')
  if (!verifier) throw new Error('Code verifier が見つかりません')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error('トークンの取得に失敗しました')
  const data = await res.json()
  sessionStorage.removeItem('spotify_code_verifier')
  return data.access_token
}

export interface SpotifyPlayedItem {
  track: {
    name: string
    duration_ms: number
    artists: Array<{ name: string }>
    album: { name: string }
  }
  played_at: string
}

export async function fetchRecentlyPlayed(token: string): Promise<SpotifyPlayedItem[]> {
  const items: SpotifyPlayedItem[] = []
  let url: string | null = 'https://api.spotify.com/v1/me/player/recently-played?limit=50'

  // Paginate as far back as possible (Spotify allows ~50 items total but we try)
  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) break
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    items.push(...(data.items || []))
    // Use cursor-based pagination
    url = data.cursors?.before
      ? `https://api.spotify.com/v1/me/player/recently-played?limit=50&before=${data.cursors.before}`
      : null
    // Stop after 5 pages to avoid rate limiting
    if (items.length >= 250) break
  }
  return items
}

export function convertToSpotifyEntries(items: SpotifyPlayedItem[]): Array<{
  name: string
  content: string
}> {
  const entries = items.map(item => ({
    ts: item.played_at,
    ms_played: item.track.duration_ms,
    master_metadata_track_name: item.track.name,
    master_metadata_album_artist_name: item.track.artists[0]?.name || null,
    master_metadata_album_album_name: item.track.album.name,
  }))
  return [{ name: 'spotify-api.json', content: JSON.stringify(entries) }]
}
