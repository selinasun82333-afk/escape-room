// ========================================
// 힌트 보기 페이지 (Supabase 실시간 동기화)
// ========================================

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePlayerStore } from '../../store/playerStore'
import { useSupabaseStore } from '../../store/supabaseStore'

export function PlayerHint() {
  const { puzzleId } = useParams<{ puzzleId: string }>()
  const navigate = useNavigate()
  const { team, setTeam } = usePlayerStore()
  const { 
    puzzles, 
    teams, 
    isLoading,
    isInitialized,
    initialize,
    getHintsForPuzzle, 
    hasUsedHint, 
    useHint, 
    useHintCoin 
  } = useSupabaseStore()
  
  const [confirmModal, setConfirmModal] = useState<{ hintId: string; cost: number } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Supabase 초기화
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize()
    }
  }, [isInitialized, isLoading, initialize])
  
  const puzzle = puzzles.find(p => p.id === puzzleId)
  const hints = puzzle ? getHintsForPuzzle(puzzle.id) : []
  const currentTeam = teams.find(t => t.id === team?.id)
  
  // 팀 데이터 동기화
  useEffect(() => {
    if (currentTeam && team) {
      if (currentTeam.hints_remaining !== team.hintsRemaining) {
        setTeam({ ...team, hintsRemaining: currentTeam.hints_remaining })
      }
    }
  }, [currentTeam?.hints_remaining, team?.hintsRemaining, setTeam])
  
  if (isLoading) {
    return (
      <div className="mobile-container min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">로딩 중...</p>
        </div>
      </div>
    )
  }
  
  if (!puzzle || !team || !currentTeam) {
    return (
      <div className="mobile-container min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❓</div>
          <div className="text-white text-xl mb-4">퍼즐을 찾을 수 없습니다</div>
          <button onClick={() => navigate('/play')} className="btn btn-primary">
            돌아가기
          </button>
        </div>
      </div>
    )
  }
  
  const handleUseHint = async (hintId: string, cost: number) => {
    if (cost === 0) {
      // 무료 힌트는 바로 사용
      await useHint(team.id, hintId)
    } else {
      // 유료 힌트는 확인창
      setConfirmModal({ hintId, cost })
    }
  }
  
  const confirmUseHint = async () => {
    if (!confirmModal || isProcessing) return
    
    setIsProcessing(true)
    try {
      const success = await useHintCoin(team.id, confirmModal.cost)
      if (success) {
        await useHint(team.id, confirmModal.hintId)
        // 팀 데이터 업데이트
        const updatedTeam = teams.find(t => t.id === team.id)
        if (updatedTeam) {
          setTeam({ ...team, hintsRemaining: updatedTeam.hints_remaining })
        }
      }
    } finally {
      setIsProcessing(false)
      setConfirmModal(null)
    }
  }
  
  return (
    <div className="mobile-container min-h-screen bg-slate-900 pb-8">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-lg border-b border-slate-700">
        <div className="px-4 py-3 flex items-center gap-4">
          <button 
            onClick={() => navigate('/play')}
            className="p-2 hover:bg-slate-800 rounded-lg"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{puzzle.name}</h1>
            <p className="text-sm text-slate-400">힌트 보기</p>
          </div>
        </div>
      </header>
      
      {/* 남은 코인 */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between p-3 bg-amber-900/30 border border-amber-600/50 rounded-xl">
          <span className="text-amber-200">남은 코인</span>
          <span className="text-xl font-bold text-amber-400">🪙 x {currentTeam.hints_remaining}</span>
        </div>
      </div>
      
      {/* 힌트 목록 */}
      <div className="px-4 space-y-4">
        {hints.map((hint) => {
          const isUsed = hasUsedHint(team.id, hint.id)
          const canAfford = currentTeam.hints_remaining >= hint.coin_cost
          
          const cardStyles: Record<number, string> = {
            1: 'hint-card-free',
            2: 'hint-card-coin1',
            3: 'hint-card-coin2',
          }
          
          return (
            <div key={hint.id} className={`hint-card ${cardStyles[hint.level] || ''}`}>
              {/* 힌트 헤더 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    hint.level === 1 
                      ? 'bg-emerald-600 text-white' 
                      : hint.level === 2
                        ? 'bg-amber-600 text-white'
                        : 'bg-red-600 text-white'
                  }`}>
                    {hint.level}단계
                  </span>
                  {hint.coin_cost === 0 ? (
                    <span className="text-emerald-400 text-sm">무료</span>
                  ) : (
                    <span className="text-amber-400 text-sm">🪙 x {hint.coin_cost}</span>
                  )}
                </div>
                {isUsed && (
                  <span className="text-emerald-400 text-sm">✓ 확인완료</span>
                )}
              </div>
              
              {/* 힌트 내용 */}
              {isUsed ? (
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-white leading-relaxed">{hint.content}</p>
                </div>
              ) : (
                <button
                  onClick={() => handleUseHint(hint.id, hint.coin_cost)}
                  disabled={!canAfford && hint.coin_cost > 0}
                  className={`w-full p-4 rounded-lg text-center transition-all ${
                    canAfford || hint.coin_cost === 0
                      ? 'bg-slate-700/50 hover:bg-slate-600/50 text-white cursor-pointer'
                      : 'bg-slate-800/30 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {canAfford || hint.coin_cost === 0 ? (
                    <span className="flex items-center justify-center gap-2">
                      <span>🔒</span>
                      <span>터치해서 힌트 확인</span>
                    </span>
                  ) : (
                    <span>코인이 부족합니다</span>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
      
      {/* 돌아가기 버튼 */}
      <div className="px-4 pt-6">
        <button
          onClick={() => navigate('/play')}
          className="btn btn-secondary w-full"
        >
          메인으로 돌아가기
        </button>
      </div>
      
      {/* 확인 모달 */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => !isProcessing && setConfirmModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-5xl mb-4">🪙</div>
              <h3 className="text-xl font-bold text-white mb-2">힌트 사용</h3>
              <p className="text-slate-300 mb-6">
                코인 <span className="text-amber-400 font-bold">{confirmModal.cost}개</span>를 사용해<br />
                힌트를 확인하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  disabled={isProcessing}
                  className="btn btn-ghost flex-1"
                >
                  취소
                </button>
                <button
                  onClick={confirmUseHint}
                  disabled={isProcessing}
                  className="btn btn-primary flex-1"
                >
                  {isProcessing ? '처리 중...' : '확인'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
