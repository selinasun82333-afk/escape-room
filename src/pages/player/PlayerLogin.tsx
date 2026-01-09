// ========================================
// 팀원 로그인 페이지 (Supabase)
// ========================================

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { usePlayerStore } from '../../store/playerStore'
import { useSupabaseStore } from '../../store/supabaseStore'

export function PlayerLogin() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isShaking, setIsShaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { setTeam } = usePlayerStore()
  const { teams, isConnected, isLoading: isInitializing, isInitialized, initialize, getTeamByCode } = useSupabaseStore()
  
  // Supabase 초기화
  useEffect(() => {
    if (!isInitialized && !isInitializing) {
      initialize()
    }
  }, [isInitialized, isInitializing, initialize])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode) {
      setError('팀 코드를 입력해주세요')
      triggerShake()
      return
    }
    
    setIsLoading(true)
    
    // Supabase에서 팀 찾기
    const team = getTeamByCode(trimmedCode)
    
    if (!team) {
      setError('존재하지 않는 팀 코드입니다')
      triggerShake()
      setIsLoading(false)
      return
    }
    
    // 팀 정보 저장 (로컬 스토리지)
    setTeam({
      id: team.id,
      eventId: team.event_id,
      name: team.name,
      color: team.color,
      joinCode: team.join_code,
      hintsRemaining: team.hints_remaining,
    })
    
    navigate('/play')
  }
  
  const triggerShake = () => {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 300)
  }
  
  // 팀 코드 힌트 표시
  const sampleCodes = teams.slice(0, 4).map(t => ({
    code: t.join_code,
    color: t.color,
  }))
  
  return (
    <div className="mobile-container flex flex-col min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
      {/* 상단 장식 */}
      <div className="absolute top-0 left-0 right-0 h-64 overflow-hidden">
        <div className="absolute top-10 left-1/4 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-24 h-24 bg-purple-500/20 rounded-full blur-3xl" />
      </div>
      
      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        {/* 로고 영역 */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-white mb-2">방탈출</h1>
          <p className="text-lg text-indigo-300">힌트 시스템</p>
          {isConnected && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-emerald-400">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              연결됨
            </div>
          )}
        </div>
        
        {/* 로그인 카드 */}
        <div className="w-full max-w-sm">
          {isInitializing ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-400">연결 중...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  팀 코드 입력
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase())
                    setError('')
                  }}
                  placeholder="예: PURPLE, RED123"
                  className={`input text-center text-2xl tracking-widest uppercase ${isShaking ? 'shake' : ''}`}
                  autoComplete="off"
                  autoCapitalize="characters"
                  disabled={isLoading}
                />
              </div>
              
              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 px-4 rounded-lg">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading || isInitializing}
                className="btn btn-primary w-full text-lg py-4 disabled:opacity-50"
              >
                {isLoading ? '로그인 중...' : '입장하기'}
              </button>
            </form>
          )}
          
          {/* 팀 코드 힌트 */}
          {sampleCodes.length > 0 && (
            <div className="mt-8 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <p className="text-sm text-slate-400 text-center">
                팀 코드는 관리자에게 문의하세요
              </p>
              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                {sampleCodes.map(({ code, color }) => (
                  <span 
                    key={code}
                    className="px-3 py-1 rounded-full text-xs text-white"
                    style={{ backgroundColor: `${color}40`, borderColor: color, borderWidth: 1 }}
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 하단 관리자 링크 */}
      <div className="p-6 text-center">
        <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-400">
          관리자 로그인 →
        </Link>
      </div>
    </div>
  )
}
