// ========================================
// 팀원 메인 페이지 (Supabase 실시간 동기화)
// ========================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayerStore } from '../../store/playerStore'
import { useSupabaseStore } from '../../store/supabaseStore'
import { QRScanner } from '../../components/QRScanner'
import { CodeInputModal } from '../../components/CodeInputModal'

export function PlayerMain() {
  const navigate = useNavigate()
  const { team, logout, setTeam } = usePlayerStore()
  const { 
    event, 
    teams, 
    stages,
    isConnected,
    isLoading,
    isInitialized,
    initialize,
    getStageByCode, 
    getHintByCode, 
    viewStage, 
    hasViewedStage 
  } = useSupabaseStore()
  
  const [showStageScanner, setShowStageScanner] = useState(false)
  const [showHintModal, setShowHintModal] = useState(false)
  const [remainingTime, setRemainingTime] = useState<number | null>(null)
  
  // Supabase 초기화
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize()
    }
  }, [isInitialized, isLoading, initialize])
  
  // 현재 팀 데이터 동기화 (실시간 업데이트 반영)
  const currentTeam = teams.find(t => t.id === team?.id)
  useEffect(() => {
    if (currentTeam && team) {
      // Supabase에서 업데이트된 팀 데이터로 로컬 상태 업데이트
      if (currentTeam.hints_remaining !== team.hintsRemaining) {
        setTeam({ ...team, hintsRemaining: currentTeam.hints_remaining })
      }
    }
  }, [currentTeam?.hints_remaining, team?.hintsRemaining, setTeam])
  
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
  
  const handleStageCode = (code: string) => {
    const stage = getStageByCode(code)
    if (stage && team) {
      viewStage(team.id, stage.id)
      setShowStageScanner(false)
      navigate(`/stage/${stage.id}`)
      return true
    }
    return false
  }
  
  const handleHintCode = (code: string) => {
    const hint = getHintByCode(code)
    if (hint) {
      setShowHintModal(false)
      // URL에 hint_code를 전달 (PlayerHint에서 해당 코드의 힌트들을 로드)
      navigate(`/hint/${hint.hint_code}`)
      return true
    }
    return false
  }
  
  const handleLogout = () => {
    logout()
    navigate('/')
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
  
  if (!team || !currentTeam) return null
  
  return (
    <div className="mobile-container min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 pb-24">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-lg border-b border-slate-700">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: currentTeam.color }}
            >
              {currentTeam.name[0]}
            </div>
            <div>
              <div className="font-semibold text-white">{currentTeam.name}</div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                {event.name}
                {isConnected && (
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" title="실시간 연결됨" />
                )}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>
      
      {/* 타이머 */}
      <section className="px-4 py-8">
        <div className={`card p-6 text-center ${event.status === 'running' ? 'timer-running' : ''}`}>
          <div className="text-sm text-slate-400 mb-2">
            {event.status === 'waiting' && '대기 중'}
            {event.status === 'running' && '🔴 진행 중'}
            {event.status === 'paused' && '⏸️ 일시정지'}
            {event.status === 'finished' && '종료'}
          </div>
          <div className={`timer-display text-6xl font-bold ${
            remainingTime !== null && remainingTime < 300 
              ? 'text-red-400' 
              : remainingTime !== null && remainingTime < 600
                ? 'text-amber-400'
                : 'text-white'
          }`}>
            {remainingTime !== null ? formatTime(remainingTime) : '--:--'}
          </div>
          {event.status === 'waiting' && (
            <div className="mt-4 text-sm text-slate-400">
              관리자가 시작 버튼을 누르면 타이머가 시작됩니다
            </div>
          )}
        </div>
      </section>
      
      {/* 힌트 코인 */}
      <section className="px-4 pb-6">
        <div className="card p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🪙</span>
            <span className="text-slate-300">힌트 코인</span>
          </div>
          <div className="text-3xl font-bold text-amber-400">
            x {currentTeam.hints_remaining}
          </div>
        </div>
      </section>
      
      {/* 스테이지 버튼 */}
      <section className="px-4 pb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📍</span> 스테이지
        </h2>
        <div className="grid gap-3">
          {stages.map((stage, index) => {
            const isViewed = hasViewedStage(team.id, stage.id)
            const colors = [
              'from-purple-600/30 to-purple-800/30',
              'from-blue-600/30 to-blue-800/30',
              'from-emerald-600/30 to-emerald-800/30',
              'from-amber-600/30 to-amber-800/30',
              'from-rose-600/30 to-rose-800/30',
            ]
            const icons = ['🚪', '📦', '🌆', '🏠', '🗝️']
            
            return (
              <button
                key={stage.id}
                onClick={() => isViewed ? navigate(`/stage/${stage.id}`) : setShowStageScanner(true)}
                className={`stage-btn ${colors[index % colors.length]} ${isViewed ? 'ring-2 ring-emerald-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icons[index % icons.length]}</span>
                    <span className="text-lg font-medium text-white">{stage.name}</span>
                  </div>
                  {isViewed ? (
                    <span className="text-emerald-400 text-sm">✓ 입장완료</span>
                  ) : (
                    <span className="text-slate-400 text-sm">QR 스캔 →</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>
      
      {/* 하단 고정 힌트 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent">
        <div className="max-w-[430px] mx-auto">
          <button
            onClick={() => setShowHintModal(true)}
            className="btn w-full py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-lg flex items-center justify-center gap-2"
          >
            <span className="text-xl">💡</span>
            힌트 보기
          </button>
        </div>
      </div>
      
      {/* QR 스캐너 (스테이지 코드) */}
      <QRScanner
        isOpen={showStageScanner}
        onClose={() => setShowStageScanner(false)}
        onScan={handleStageCode}
        title="스테이지 입장"
        placeholder="코드를 입력하세요"
        errorMessage="존재하지 않는 코드입니다"
      />
      
      {/* 힌트 코드 입력 모달 */}
      <CodeInputModal
        isOpen={showHintModal}
        onClose={() => setShowHintModal(false)}
        onSubmit={handleHintCode}
        title="힌트 코드 입력"
        placeholder="퍼즐의 힌트 코드를 입력하세요"
        errorMessage="존재하지 않는 힌트 코드입니다"
      />
    </div>
  )
}
