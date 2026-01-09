// ========================================
// 관리자 모니터링 탭 (Supabase 실시간 동기화)
// ========================================

import { useSupabaseStore } from '../../store/supabaseStore'

export function AdminMonitoring() {
  const { teams, stages, puzzles, puzzleHints, stageViews, hintUsages } = useSupabaseStore()
  
  const getTeamStageViewCount = (teamId: string) => {
    return stageViews.filter(sv => sv.team_id === teamId).length
  }
  
  const getTeamHintUsageCount = (teamId: string) => {
    return hintUsages.filter(hu => hu.team_id === teamId).length
  }
  
  const getTeamUsedHints = (teamId: string) => {
    return hintUsages
      .filter(hu => hu.team_id === teamId)
      .map(hu => {
        const hint = puzzleHints.find(h => h.id === hu.puzzle_hint_id)
        const puzzle = hint ? puzzles.find(p => p.id === hint.puzzle_id) : null
        return { hint, puzzle, usedAt: hu.used_at }
      })
      .filter(x => x.hint && x.puzzle)
  }
  
  const getTeamViewedStages = (teamId: string) => {
    return stageViews
      .filter(sv => sv.team_id === teamId)
      .map(sv => {
        const stage = stages.find(s => s.id === sv.stage_id)
        return { stage, viewedAt: sv.viewed_at }
      })
      .filter(x => x.stage)
  }
  
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <span>👥</span> 팀 현황
        <span className="text-sm font-normal text-slate-400">
          (실시간 업데이트)
        </span>
      </h2>
      
      {teams.map(team => {
        const viewedStages = getTeamViewedStages(team.id)
        const usedHints = getTeamUsedHints(team.id)
        
        return (
          <div key={team.id} className="card p-4">
            {/* 팀 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: team.color }}
                >
                  {team.name[0]}
                </div>
                <div>
                  <div className="font-semibold text-white">{team.name}</div>
                  <div className="text-xs text-slate-400">코드: {team.join_code}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-amber-400 font-bold text-xl">🪙 x {team.hints_remaining}</div>
                <div className="text-xs text-slate-400">남은 코인</div>
              </div>
            </div>
            
            {/* 진행 상황 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                <div className="text-2xl font-bold text-emerald-400">
                  {getTeamStageViewCount(team.id)} / {stages.length}
                </div>
                <div className="text-xs text-slate-400">스테이지</div>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {getTeamHintUsageCount(team.id)}
                </div>
                <div className="text-xs text-slate-400">사용한 힌트</div>
              </div>
            </div>
            
            {/* 상세 정보 토글 */}
            <details className="group">
              <summary className="cursor-pointer text-sm text-slate-400 hover:text-white">
                상세 보기 ▼
              </summary>
              <div className="mt-3 space-y-3">
                {/* 입장한 스테이지 */}
                <div>
                  <div className="text-xs text-slate-500 mb-2">입장한 스테이지</div>
                  {viewedStages.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {viewedStages.map(({ stage }) => (
                        <span key={stage!.id} className="px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded text-xs">
                          {stage!.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">없음</span>
                  )}
                </div>
                
                {/* 사용한 힌트 */}
                <div>
                  <div className="text-xs text-slate-500 mb-2">사용한 힌트</div>
                  {usedHints.length > 0 ? (
                    <div className="space-y-1">
                      {usedHints.map(({ hint, puzzle }) => (
                        <div key={hint!.id} className="text-xs">
                          <span className="text-slate-400">{puzzle!.name}</span>
                          <span className="mx-1 text-slate-600">→</span>
                          <span className={`${
                            hint!.level === 1 ? 'text-emerald-400' :
                            hint!.level === 2 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {hint!.level}단계
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">없음</span>
                  )}
                </div>
              </div>
            </details>
          </div>
        )
      })}
      
      {teams.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          등록된 팀이 없습니다
        </div>
      )}
    </div>
  )
}
