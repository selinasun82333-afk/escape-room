// ========================================
// 플레이어(팀원) 상태 관리
// ========================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Team } from './types'

interface PlayerStore {
  team: Team | null
  setTeam: (team: Team | null) => void
  logout: () => void
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      team: null,
      setTeam: (team) => set({ team }),
      logout: () => set({ team: null }),
    }),
    {
      name: 'escape-room-player',
    }
  )
)

