// ========================================
// 스테이지(웹툰) 보기 페이지 (Supabase)
// ========================================

import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSupabaseStore } from '../../store/supabaseStore'

export function PlayerStage() {
  const { stageId } = useParams<{ stageId: string }>()
  const navigate = useNavigate()
  const { stages, isLoading, isInitialized, initialize } = useSupabaseStore()
  
  // Supabase 초기화
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize()
    }
  }, [isInitialized, isLoading, initialize])
  
  const stage = stages.find(s => s.id === stageId)
  
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
  
  if (!stage) {
    return (
      <div className="mobile-container min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❓</div>
          <div className="text-white text-xl mb-4">스테이지를 찾을 수 없습니다</div>
          <button onClick={() => navigate('/play')} className="btn btn-primary">
            돌아가기
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="mobile-container min-h-screen bg-slate-900">
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
          <h1 className="text-xl font-bold text-white">{stage.name}</h1>
        </div>
      </header>
      
      {/* 웹툰 이미지 */}
      <div className="p-4">
        <div className="rounded-2xl overflow-hidden border border-slate-700">
          <img
            src={stage.webtoon_image_url || `https://placehold.co/400x600/1a1a2e/white?text=${encodeURIComponent(stage.name)}`}
            alt={stage.name}
            className="w-full h-auto"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = `https://placehold.co/400x600/1a1a2e/white?text=${encodeURIComponent(stage.name)}`
            }}
          />
        </div>
      </div>
      
      {/* 하단 돌아가기 버튼 */}
      <div className="p-4 pb-8">
        <button
          onClick={() => navigate('/play')}
          className="btn btn-secondary w-full"
        >
          메인으로 돌아가기
        </button>
      </div>
    </div>
  )
}
