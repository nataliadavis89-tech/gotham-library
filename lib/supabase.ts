import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type BookStatus = 'pending' | 'reading' | 'finished' | 'abandoned' | 'wishlist'

export type Book = {
  id: string
  title: string
  author: string
  status: BookStatus
  rating?: number
  progress?: number
  genre?: string
  publisher?: string
  year?: number
  isbn?: string
  synopsis?: string
  notes?: string
  would_reread?: 'yes' | 'maybe' | 'no'
  format?: string
  is_own?: boolean
  custom_cover?: string
  created_at?: string
  updated_at?: string
}

export type RewardLog = {
  id?: string
  type: 'earn' | 'spend'
  label: string
  amount: number
  date: string
}
