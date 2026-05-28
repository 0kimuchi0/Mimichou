export interface WishlistItem {
  id: string
  text: string
  savedAt: string
}

export interface CloudHistoryStats {
  topArtists: Array<{ artist: string; totalMinutes: number; playCount: number }>
  topTracks: Array<{ track: string; artist: string; totalMinutes: number; playCount: number }>
  dateRange: { from: string; to: string }
  totalEntries: number
  uploadedAt?: string
}

export interface CloudData {
  wishlist: WishlistItem[]
  historyStats: CloudHistoryStats | null
}

const BASE = '/api/user-data'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function fetchCloudData(token: string): Promise<CloudData | null> {
  try {
    const res = await fetch(BASE, { headers: authHeaders(token) })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export async function saveWishlist(token: string, items: WishlistItem[]): Promise<void> {
  try {
    await fetch(BASE, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ type: 'wishlist', data: items }),
    })
  } catch { /* silent */ }
}

export async function saveHistoryStats(token: string, stats: CloudHistoryStats): Promise<void> {
  try {
    await fetch(BASE, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ type: 'history', data: stats }),
    })
  } catch { /* silent */ }
}
