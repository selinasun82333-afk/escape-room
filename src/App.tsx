import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useLayoutEffect, useState, useEffect } from 'react'
import { PlayerLogin } from './pages/player/PlayerLogin'
import { PlayerMain } from './pages/player/PlayerMain'
import { PlayerStage } from './pages/player/PlayerStage'
import { PlayerHint } from './pages/player/PlayerHint'
import { AdminLogin } from './pages/admin/AdminLogin'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { usePlayerStore } from './store/playerStore'
import { useAdminStore } from './store/adminStore'
import { useSupabaseStore } from './store/supabaseStore'

// 팀원 보호 라우트
function PlayerRoute({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams()
  const { team, setTeam } = usePlayerStore()
  const { getTeamByCode, isInitialized, isLoading, initialize } = useSupabaseStore()
  const [checked, setChecked] = useState(false)
  
  // Supabase 초기화
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize()
    }
  }, [isInitialized, isLoading, initialize])
  
  useLayoutEffect(() => {
    if (!isInitialized) return
    
    const dev = searchParams.get('dev')
    if (dev?.startsWith('player:')) {
      const code = dev.split(':')[1]
      const foundTeam = getTeamByCode(code)
      if (foundTeam) {
        setTeam({
          id: foundTeam.id,
          eventId: foundTeam.event_id,
          name: foundTeam.name,
          color: foundTeam.color,
          joinCode: foundTeam.join_code,
          hintsRemaining: foundTeam.hints_remaining,
        })
      }
    }
    setChecked(true)
  }, [searchParams, setTeam, getTeamByCode, isInitialized])
  
  if (!isInitialized || !checked) return null
  if (!team) return <Navigate to="/" replace />
  return <>{children}</>
}

// 관리자 보호 라우트
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, checkAuth } = useAdminStore()
  const [isChecking, setIsChecking] = useState(true)
  
  useEffect(() => {
    const verify = async () => {
      await checkAuth()
      setIsChecking(false)
    }
    verify()
  }, [checkAuth])
  
  // 인증 확인 중
  if (isChecking) {
    return (
      <div className="mobile-container min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }
  
  if (!isLoggedIn) return <Navigate to="/admin" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 팀원 페이지 */}
        <Route path="/" element={<PlayerLogin />} />
        <Route path="/play" element={<PlayerRoute><PlayerMain /></PlayerRoute>} />
        <Route path="/stage/:stageId" element={<PlayerRoute><PlayerStage /></PlayerRoute>} />
        <Route path="/hint/:puzzleId" element={<PlayerRoute><PlayerHint /></PlayerRoute>} />
        
        {/* 관리자 페이지 */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
