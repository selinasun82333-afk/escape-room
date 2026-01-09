// ========================================
// 관리자 대시보드 (Supabase 실시간 동기화)
// ========================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminStore } from '../../store/adminStore'
import { useSupabaseStore } from '../../store/supabaseStore'
import { AdminMonitoring } from './AdminMonitoring'
import { AdminSettings } from './AdminSettings'

type Tab = 'monitoring' | 'settings'

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('monitoring')
  const navigate = useNavigate()
  const { logout, email } = useAdminStore()
  const { 
    event, 
    isConnected,
    isLoading,
    isInitialized,
    initialize,
    startTimer, 
    pauseTimer, 
    resumeTimer, 
    resetTimer 
  } = useSupabaseStore()
  
  const [remainingTime, setRemainingTime] = useState<number | null>(null)
  
  // Supabase 초기화
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize()
    }
  }, [isInitialized, isLoading, initialize])
  
  // 타이머 계산 (실시간 event 상태 기반)
  useEffect(() => {
    if (!event) return
    
    const calculateTime = () => {
      if (event.status === 'waiting') {
        setRemainingTime(event.duration_minutes * 60)
        return
      }
      
      if (event.status === 'finished') {
        setRemainingTime(0)
        return
      }
      
      if (!event.started_at) return
      
      const now = Date.now()
      const startedAt = new Date(event.started_at).getTime()
      const pausedDuration = event.paused_duration || 0
      
      const elapsed = event.status === 'paused' && event.paused_at
        ? (new Date(event.paused_at).getTime() - startedAt - pausedDuration) / 1000
        : (now - startedAt - pausedDuration) / 1000
      
      const remaining = Math.max(0, event.duration_minutes * 60 - elapsed)
      setRemainingTime(Math.floor(remaining))
    }
    
    calculateTime()
    const interval = setInterval(calculateTime, 1000)
    return () => clearInterval(interval)
  }, [event])
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  const handleLogout = async () => {
    await logout()
    navigate('/admin')
  }
  
  // 로딩 상태
  if (isLoading || !event) {
    return (
      <div className="mobile-container min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">연결 중...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="mobile-container min-h-screen bg-slate-900">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-lg border-b border-slate-700">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-white flex items-center gap-2">
              관리자 대시보드
              {isConnected && (
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" title="실시간 연결됨" />
              )}
            </h1>
            <p className="text-xs text-slate-400">{email}</p>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost text-sm py-2 px-3">
            로그아웃
          </button>
        </div>
      </header>
      
      {/* 타이머 컨트롤 */}
      <section className="px-4 py-4 border-b border-slate-700">
        <div className="card p-4">
          <div className="text-center mb-4">
            <div className="text-sm text-slate-400 mb-1">
              {event.status === 'waiting' && '대기 중'}
              {event.status === 'running' && '🟢 진행 중'}
              {event.status === 'paused' && '⏸️ 일시정지'}
              {event.status === 'finished' && '종료'}
            </div>
            <div className={`timer-display text-5xl font-bold ${
              remainingTime !== null && remainingTime < 300 
                ? 'text-red-400' 
                : remainingTime !== null && remainingTime < 600
                  ? 'text-amber-400'
                  : 'text-white'
            }`}>
              {remainingTime !== null ? formatTime(remainingTime) : '--:--'}
            </div>
          </div>
          
          <div className="flex gap-2">
            {event.status === 'waiting' && (
              <button onClick={startTimer} className="btn btn-primary flex-1">
                ▶ 시작
              </button>
            )}
            {event.status === 'running' && (
              <button onClick={pauseTimer} className="btn btn-secondary flex-1">
                ⏸ 일시정지
              </button>
            )}
            {event.status === 'paused' && (
              <button onClick={resumeTimer} className="btn btn-primary flex-1">
                ▶ 재개
              </button>
            )}
            <button 
              onClick={resetTimer} 
              className="btn btn-danger"
              disabled={event.status === 'waiting'}
            >
              리셋
            </button>
          </div>
        </div>
      </section>
      
      {/* 탭 네비게이션 */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('monitoring')}
          className={`flex-1 py-3 text-center font-medium transition-colors ${
            activeTab === 'monitoring'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📊 모니터링
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-center font-medium transition-colors ${
            activeTab === 'settings'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ⚙️ 설정
        </button>
      </div>
      
      {/* 탭 컨텐츠 */}
      <div className="pb-8">
        {activeTab === 'monitoring' && <AdminMonitoring />}
        {activeTab === 'settings' && <AdminSettings />}
      </div>
    </div>
  )
}
