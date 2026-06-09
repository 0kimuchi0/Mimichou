import type { VercelRequest, VercelResponse } from '@vercel/node'

interface VerifiedUser {
  id: string
  display_name: string
  image_url: string | null
}

async function verifySpotifyToken(token: string): Promise<VerifiedUser | null> {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return {
    id: `spotify_${data.id as string}`,
    display_name: (data.display_name || data.id) as string,
    image_url: (data.images?.[0]?.url ?? null) as string | null,
  }
}

async function verifyGoogleToken(token: string): Promise<VerifiedUser | null> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return {
    id: `google_${data.sub as string}`,
    display_name: (data.name || data.email) as string,
    image_url: (data.picture ?? null) as string | null,
  }
}

// Direct Supabase REST API calls — no SDK, no background tasks
class SupabaseRest {
  private base: string
  private headers: Record<string, string>

  constructor(url: string, serviceKey: string) {
    this.base = `${url}/rest/v1`
    this.headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    }
  }

  async upsertUser(user: VerifiedUser): Promise<string | null> {
    const res = await fetch(`${this.base}/users`, {
      method: 'POST',
      headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        id: user.id,
        display_name: user.display_name,
        image_url: user.image_url,
      }),
    })
    if (!res.ok) return await res.text()
    return null
  }

  async getWishlist(userId: string): Promise<unknown[]> {
    const res = await fetch(`${this.base}/wishlists?user_id=eq.${encodeURIComponent(userId)}&select=items`, {
      headers: this.headers,
    })
    if (!res.ok) return []
    const rows = await res.json() as Array<{ items: unknown[] }>
    return rows[0]?.items ?? []
  }

  async getHistorySnapshot(userId: string): Promise<Record<string, unknown> | null> {
    const res = await fetch(`${this.base}/history_snapshots?user_id=eq.${encodeURIComponent(userId)}`, {
      headers: this.headers,
    })
    if (!res.ok) return null
    const rows = await res.json() as Array<Record<string, unknown>>
    return rows[0] ?? null
  }

  async upsertWishlist(userId: string, items: unknown): Promise<void> {
    await fetch(`${this.base}/wishlists`, {
      method: 'POST',
      headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: userId, items, updated_at: new Date().toISOString() }),
    })
  }

  async upsertHistory(userId: string, d: Record<string, unknown>): Promise<void> {
    await fetch(`${this.base}/history_snapshots`, {
      method: 'POST',
      headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: userId,
        top_artists: d.topArtists,
        top_tracks: d.topTracks,
        date_range: d.dateRange,
        total_entries: d.totalEntries,
        uploaded_at: new Date().toISOString(),
      }),
    })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'missing_env', detail: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' })
  }

  try {
    const db = new SupabaseRest(supabaseUrl, supabaseKey)

    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })

    const prefixedToken = auth.slice(7)
    const colonIdx = prefixedToken.indexOf(':')
    if (colonIdx === -1) return res.status(401).json({ error: 'Invalid token format' })

    const provider = prefixedToken.slice(0, colonIdx)
    const accessToken = prefixedToken.slice(colonIdx + 1)

    let verifiedUser: VerifiedUser | null = null
    if (provider === 'spotify') {
      verifiedUser = await verifySpotifyToken(accessToken)
    } else if (provider === 'google') {
      verifiedUser = await verifyGoogleToken(accessToken)
    }

    if (!verifiedUser) return res.status(401).json({ error: 'Invalid token' })

    const upsertErr = await db.upsertUser(verifiedUser)
    if (upsertErr) return res.status(500).json({ error: 'db_upsert_failed', detail: upsertErr })

    if (req.method === 'GET') {
      const [wishlist, hs] = await Promise.all([
        db.getWishlist(verifiedUser.id),
        db.getHistorySnapshot(verifiedUser.id),
      ])

      return res.status(200).json({
        wishlist,
        historyStats: hs
          ? {
              topArtists: hs.top_artists,
              topTracks: hs.top_tracks,
              dateRange: hs.date_range,
              totalEntries: hs.total_entries,
              uploadedAt: hs.uploaded_at,
            }
          : null,
      })
    }

    if (req.method === 'POST') {
      const { type, data } = req.body as { type: string; data: unknown }

      if (type === 'wishlist') {
        await db.upsertWishlist(verifiedUser.id, data)
      } else if (type === 'history') {
        await db.upsertHistory(verifiedUser.id, data as Record<string, unknown>)
      }

      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: 'internal', detail: e instanceof Error ? e.message : String(e) })
  }
}
