// ========================================
// 관리자 로그인 페이지 (Supabase Auth)
// ========================================

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAdminStore } from '../../store/adminStore'

export function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { login, isLoggedIn, checkAuth } = useAdminStore()
  
  // 이미 로그인된 경우 대시보드로 리다이렉트
  useEffect(() => {
    const checkExistingAuth = async () => {
      const isAuthenticated = await checkAuth()
      if (isAuthenticated) {
        navigate('/admin/dashboard', { replace: true })
      }
    }
    checkExistingAuth()
  }, [checkAuth, navigate])
  
  // isLoggedIn 상태가 변경되면 리다이렉트
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/admin/dashboard', { replace: true })
    }
  }, [isLoggedIn, navigate])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요')
      return
    }
    
    setIsLoading(true)
    
    const result = await login(email, password)
    
    if (result.success) {
      navigate('/admin/dashboard')
    } else {
      setError(result.error || '로그인에 실패했습니다')
    }
    
    setIsLoading(false)
  }
  
  return (
    <div className="mobile-container flex flex-col min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* 로고 영역 */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">⚙️</div>
          <h1 className="text-2xl font-bold text-white mb-2">관리자 로그인</h1>
          <p className="text-slate-400">방탈출 힌트 시스템</p>
        </div>
        
        {/* 로그인 폼 */}
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                placeholder="admin@example.com"
                className="input"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="••••••••"
                className="input"
                autoComplete="current-password"
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
              disabled={isLoading}
              className="btn btn-primary w-full text-lg py-4 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  로그인 중...
                </span>
              ) : (
                '로그인'
              )}
            </button>
          </form>
          
          {/* 안내 메시지 */}
          <div className="mt-8 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <p className="text-sm text-slate-400 text-center">
              관리자 계정으로 로그인하세요.
              <br />
              <span className="text-slate-500 text-xs">
                계정이 없으시면 관리자에게 문의하세요.
              </span>
            </p>
          </div>
        </div>
      </div>
      
      {/* 하단 팀원 링크 */}
      <div className="p-6 text-center">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-400">
          ← 팀원 로그인으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
