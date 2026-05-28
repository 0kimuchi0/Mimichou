import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

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

  // Upsert user record
  const { error: upsertErr } = await supabase.from('users').upsert({
    id: verifiedUser.id,
    display_name: verifiedUser.display_name,
    image_url: verifiedUser.image_url,
  })
  if (upsertErr) return res.status(500).json({ error: 'db_upsert_failed', detail: upsertErr.message })

  if (req.method === 'GET') {
    const [{ data: wl }, { data: hs }] = await Promise.all([
      supabase.from('wishlists').select('items').eq('user_id', verifiedUser.id).maybeSingle(),
      supabase.from('history_snapshots').select('*').eq('user_id', verifiedUser.id).maybeSingle(),
    ])

    return res.status(200).json({
      wishlist: wl?.items ?? [],
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
      await supabase.from('wishlists').upsert({
        user_id: verifiedUser.id,
        items: data,
        updated_at: new Date().toISOString(),
      })
    } else if (type === 'history') {
      const d = data as Record<string, unknown>
      await supabase.from('history_snapshots').upsert({
        user_id: verifiedUser.id,
        top_artists: d.topArtists,
        top_tracks: d.topTracks,
        date_range: d.dateRange,
        total_entries: d.totalEntries,
        uploaded_at: new Date().toISOString(),
      })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
