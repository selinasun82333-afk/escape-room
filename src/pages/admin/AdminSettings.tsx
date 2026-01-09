// ========================================
// 관리자 설정 탭 (Supabase)
// ========================================

import { useState } from 'react'
import { useSupabaseStore } from '../../store/supabaseStore'
import { supabase } from '../../lib/supabase'

type SettingSection = 'timer' | 'teams' | 'stages' | 'puzzles'

export function AdminSettings() {
  const [activeSection, setActiveSection] = useState<SettingSection>('timer')
  
  return (
    <div className="p-4">
      {/* 섹션 버튼 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {([
          { key: 'timer', icon: '⏱️', label: '타이머' },
          { key: 'teams', icon: '👥', label: '팀 관리' },
          { key: 'stages', icon: '🚪', label: '스테이지' },
          { key: 'puzzles', icon: '💡', label: '힌트' },
        ] as const).map(section => (
          <button
            key={section.key}
            onClick={() => setActiveSection(section.key)}
            className={`p-3 rounded-xl text-sm font-medium transition-all ${
              activeSection === section.key
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {section.icon} {section.label}
          </button>
        ))}
      </div>
      
      {/* 섹션 컨텐츠 */}
      {activeSection === 'timer' && <TimerSettings />}
      {activeSection === 'teams' && <TeamSettings />}
      {activeSection === 'stages' && <StageSettings />}
      {activeSection === 'puzzles' && <PuzzleSettings />}
    </div>
  )
}

// 타이머 설정
function TimerSettings() {
  const { event, teams, updateEvent, refreshData, updateTeam, useMockData } = useSupabaseStore()
  const [duration, setDuration] = useState(event?.duration_minutes?.toString() || '60')
  const [hintsPerTeam, setHintsPerTeam] = useState(event?.hints_per_team?.toString() || '5')
  const [isSaving, setIsSaving] = useState(false)
  
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const newDuration = parseInt(duration) || 60
      const newHints = parseInt(hintsPerTeam) || 5
      await updateEvent({ 
        duration_minutes: newDuration,
        hints_per_team: newHints,
      })
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleReset = async () => {
    if (!confirm('모든 팀 진행상황이 초기화됩니다. 계속하시겠습니까?')) return
    
    setIsSaving(true)
    try {
      if (event) {
        if (useMockData) {
          // Mock 모드: 로컬 상태만 업데이트
          for (const team of teams) {
            await updateTeam(team.id, { hints_remaining: event.hints_per_team })
          }
        } else {
          // Supabase 모드
          await supabase.from('teams')
            .update({ hints_remaining: event.hints_per_team })
            .eq('event_id', event.id)
          
          // 진행상황 삭제
          const teamIds = (await supabase.from('teams').select('id').eq('event_id', event.id)).data?.map(t => t.id) || []
          if (teamIds.length > 0) {
            await supabase.from('team_stage_views').delete().in('team_id', teamIds)
            await supabase.from('team_hint_usage').delete().in('team_id', teamIds)
          }
        }
        
        // 타이머 리셋
        await updateEvent({
          status: 'waiting',
          started_at: null,
          paused_at: null,
          paused_duration: 0,
        })
        
        // 데이터 새로고침
        await refreshData()
      }
    } finally {
      setIsSaving(false)
    }
  }
  
  return (
    <div className="card p-4 space-y-4">
      <h3 className="font-semibold text-white">타이머 설정</h3>
      
      <div>
        <label className="block text-sm text-slate-400 mb-2">게임 시간 (분)</label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="input"
          min="1"
          max="180"
        />
      </div>
      
      <div>
        <label className="block text-sm text-slate-400 mb-2">팀당 힌트 코인 수</label>
        <input
          type="number"
          value={hintsPerTeam}
          onChange={(e) => setHintsPerTeam(e.target.value)}
          className="input"
          min="0"
          max="20"
        />
      </div>
      
      <button 
        onClick={handleSave} 
        disabled={isSaving}
        className="btn btn-primary w-full"
      >
        {isSaving ? '저장 중...' : '저장'}
      </button>
      
      <hr className="border-slate-700" />
      
      <div>
        <h4 className="text-sm text-slate-400 mb-2">게임 초기화</h4>
        <button 
          onClick={handleReset}
          disabled={isSaving}
          className="btn btn-danger w-full"
        >
          🔄 전체 리셋
        </button>
      </div>
    </div>
  )
}

// 팀 관리
function TeamSettings() {
  const { teams, event, addTeam, deleteTeam } = useSupabaseStore()
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')  // 팀 코드 수동 입력
  const [newColor, setNewColor] = useState('#6366f1')
  const [isAdding, setIsAdding] = useState(false)
  
  const colors = [
    '#8b5cf6', '#ef4444', '#eab308', '#3b82f6', 
    '#10b981', '#f97316', '#ec4899', '#06b6d4'
  ]
  
  const handleAdd = async () => {
    if (!newName.trim() || !newCode.trim() || !event) return
    
    // 중복 코드 확인
    const existingTeam = teams.find(t => t.join_code.toUpperCase() === newCode.trim().toUpperCase())
    if (existingTeam) {
      alert('이미 사용 중인 팀 코드입니다. 다른 코드를 입력해주세요.')
      return
    }
    
    setIsAdding(true)
    try {
      await addTeam({
        event_id: event.id,
        name: newName.trim(),
        color: newColor,
        join_code: newCode.trim().toUpperCase(),  // 수동 입력된 코드 사용
        hints_remaining: event.hints_per_team,
      })
      setNewName('')
      setNewCode('')
    } catch (error) {
      console.error('Failed to add team:', error)
      alert('팀 추가에 실패했습니다')
    } finally {
      setIsAdding(false)
    }
  }
  
  const handleRemove = async (teamId: string, teamName: string) => {
    if (!confirm(`"${teamName}" 팀을 삭제하시겠습니까?`)) return
    try {
      await deleteTeam(teamId)
    } catch (error) {
      console.error('Failed to delete team:', error)
      alert('팀 삭제에 실패했습니다')
    }
  }
  
  return (
    <div className="space-y-4">
      {/* 새 팀 추가 */}
      <div className="card p-4">
        <h3 className="font-semibold text-white mb-3">새 팀 추가</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">팀 이름</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 보라팀"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">팀 코드 (플레이어 로그인용)</label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="예: PURPLE"
              className="input uppercase"
              maxLength={20}
            />
            <p className="text-xs text-slate-500 mt-1">* 플레이어가 이 코드를 입력해 참가합니다</p>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">팀 색상</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    newColor === color ? 'ring-2 ring-white scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <button 
            onClick={handleAdd} 
            disabled={isAdding || !newName.trim() || !newCode.trim()}
            className="btn btn-primary w-full"
          >
            {isAdding ? '추가 중...' : '팀 추가'}
          </button>
        </div>
      </div>
      
      {/* 팀 목록 */}
      <div className="card p-4">
        <h3 className="font-semibold text-white mb-3">팀 목록 ({teams.length})</h3>
        <div className="space-y-3">
          {teams.map(team => (
            <div key={team.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                style={{ backgroundColor: team.color }}
              >
                {team.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white truncate">{team.name}</div>
                <div className="text-xs text-slate-400">코드: {team.join_code}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-amber-400 text-sm">🪙 {team.hints_remaining}</div>
              </div>
              <button
                onClick={() => handleRemove(team.id, team.name)}
                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 스테이지 관리
function StageSettings() {
  const { stages, event, addStage, deleteStage, updateStage, uploadStageImage } = useSupabaseStore()
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  
  const handleAdd = async () => {
    if (!newName.trim() || !newCode.trim() || !event) return
    setIsAdding(true)
    try {
      await addStage({
        event_id: event.id,
        name: newName.trim(),
        entry_code: newCode.trim().toUpperCase(),
        webtoon_image_url: `https://placehold.co/400x600/1a1a2e/white?text=${encodeURIComponent(newName.trim())}`,
      })
      setNewName('')
      setNewCode('')
    } catch (error) {
      console.error('Failed to add stage:', error)
      alert('스테이지 추가에 실패했습니다')
    } finally {
      setIsAdding(false)
    }
  }
  
  const handleRemove = async (stageId: string, stageName: string) => {
    if (!confirm(`"${stageName}" 스테이지를 삭제하시겠습니까?`)) return
    try {
      await deleteStage(stageId)
    } catch (error) {
      console.error('Failed to delete stage:', error)
      alert('스테이지 삭제에 실패했습니다')
    }
  }
  
  const handleImageUpload = async (stageId: string, file: File) => {
    console.log('🎨 이미지 업로드 시작:', { stageId, file: file.name })
    setUploadingId(stageId)
    try {
      const url = await uploadStageImage(stageId, file)
      if (url) {
        console.log('✅ 업로드 성공! URL:', url)
        alert('이미지 업로드 완료!')
      } else {
        alert('이미지 업로드에 실패했습니다. 콘솔을 확인하세요.')
      }
    } catch (error: any) {
      console.error('❌ 이미지 업로드 에러:', error)
      alert(`이미지 업로드 실패: ${error?.message || '알 수 없는 오류'}`)
    } finally {
      setUploadingId(null)
    }
  }
  
  return (
    <div className="space-y-4">
      {/* 새 스테이지 추가 */}
      <div className="card p-4">
        <h3 className="font-semibold text-white mb-3">새 스테이지 추가</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="스테이지 이름"
            className="input"
          />
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="입장 코드 (예: ROOM001)"
            className="input uppercase"
          />
          <button 
            onClick={handleAdd} 
            disabled={isAdding || !newName.trim() || !newCode.trim()}
            className="btn btn-primary w-full"
          >
            {isAdding ? '추가 중...' : '스테이지 추가'}
          </button>
        </div>
      </div>
      
      {/* 스테이지 목록 */}
      <div className="card p-4">
        <h3 className="font-semibold text-white mb-3">스테이지 목록 ({stages.length})</h3>
        <div className="space-y-3">
          {stages.map(stage => {
            const isExpanded = expandedStage === stage.id
            const isUploading = uploadingId === stage.id
            
            return (
              <div key={stage.id} className="p-3 bg-slate-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-white">{stage.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">코드:</span>
                      <span className="px-2 py-1 bg-slate-700 rounded text-xs font-mono text-slate-300">
                        {stage.entry_code}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      {isExpanded ? '접기' : '편집'}
                    </button>
                    <button
                      onClick={() => handleRemove(stage.id, stage.name)}
                      className="p-1 text-red-400 hover:bg-red-400/10 rounded"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-700 space-y-3">
                    {/* 이미지 프리뷰 */}
                    <div className="space-y-2">
                      <label className="block text-sm text-slate-400">웹툰 이미지</label>
                      <div className="relative w-full max-w-[200px] aspect-[2/3] rounded-lg overflow-hidden bg-slate-700">
                        {stage.webtoon_image_url ? (
                          <img 
                            src={stage.webtoon_image_url}
                            alt={stage.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = `https://placehold.co/400x600/1a1a2e/white?text=${encodeURIComponent(stage.name)}`
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500">
                            <span>이미지 없음</span>
                          </div>
                        )}
                        {isUploading && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                            <div className="text-center">
                              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                              <span className="text-white text-sm">업로드 중...</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {stage.webtoon_image_url && (
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">
                          {stage.webtoon_image_url.includes('blob:') ? '(미리보기)' : '✓ 업로드됨'}
                        </p>
                      )}
                    </div>
                    
                    {/* 이미지 업로드 */}
                    <div className="space-y-2">
                      <label className="block text-sm text-slate-400">
                        이미지 {stage.webtoon_image_url ? '변경' : '업로드'}
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        disabled={isUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            // 파일 크기 체크 (10MB)
                            if (file.size > 10 * 1024 * 1024) {
                              alert('파일 크기는 10MB 이하여야 합니다.')
                              return
                            }
                            handleImageUpload(stage.id, file)
                          }
                        }}
                        className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 disabled:opacity-50"
                      />
                      <p className="text-xs text-slate-500">
                        JPG, PNG, GIF, WebP (최대 10MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// 퍼즐/힌트 관리
function PuzzleSettings() {
  const { puzzles, event, addPuzzle, deletePuzzle, addPuzzleHint, updatePuzzleHint, getHintsForPuzzle } = useSupabaseStore()
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [editingPuzzle, setEditingPuzzle] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  
  const handleAdd = async () => {
    if (!newName.trim() || !newCode.trim() || !event) return
    setIsAdding(true)
    try {
      const puzzleId = await addPuzzle({
        event_id: event.id,
        name: newName.trim(),
        hint_code: newCode.trim().toUpperCase(),
      })
      
      if (puzzleId) {
        // 기본 힌트 3개 추가
        await addPuzzleHint({ puzzle_id: puzzleId, level: 1, content: '1단계 힌트를 입력하세요', coin_cost: 0 })
        await addPuzzleHint({ puzzle_id: puzzleId, level: 2, content: '2단계 힌트를 입력하세요', coin_cost: 1 })
        await addPuzzleHint({ puzzle_id: puzzleId, level: 3, content: '3단계 힌트를 입력하세요', coin_cost: 2 })
      }
      
      setNewName('')
      setNewCode('')
    } catch (error) {
      console.error('Failed to add puzzle:', error)
      alert('퍼즐 추가에 실패했습니다')
    } finally {
      setIsAdding(false)
    }
  }
  
  const handleRemove = async (puzzleId: string, puzzleName: string) => {
    if (!confirm(`"${puzzleName}" 퍼즐을 삭제하시겠습니까?`)) return
    try {
      await deletePuzzle(puzzleId)
    } catch (error) {
      console.error('Failed to delete puzzle:', error)
      alert('퍼즐 삭제에 실패했습니다')
    }
  }
  
  const handleUpdateHint = async (hintId: string, content: string) => {
    try {
      await updatePuzzleHint(hintId, { content })
    } catch (error) {
      console.error('Failed to update hint:', error)
      alert('힌트 수정에 실패했습니다')
    }
  }
  
  return (
    <div className="space-y-4">
      {/* 새 퍼즐 추가 */}
      <div className="card p-4">
        <h3 className="font-semibold text-white mb-3">새 퍼즐 추가</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="퍼즐 이름"
            className="input"
          />
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="힌트 코드 (예: PUZZLE1)"
            className="input uppercase"
          />
          <button 
            onClick={handleAdd} 
            disabled={isAdding || !newName.trim() || !newCode.trim()}
            className="btn btn-primary w-full"
          >
            {isAdding ? '추가 중...' : '퍼즐 추가'}
          </button>
        </div>
      </div>
      
      {/* 퍼즐 목록 */}
      <div className="card p-4">
        <h3 className="font-semibold text-white mb-3">퍼즐 목록 ({puzzles.length})</h3>
        <div className="space-y-3">
          {puzzles.map(puzzle => {
            const hints = getHintsForPuzzle(puzzle.id)
            const isEditing = editingPuzzle === puzzle.id
            
            return (
              <div key={puzzle.id} className="p-3 bg-slate-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-white">{puzzle.name}</div>
                    <div className="text-xs text-slate-400">코드: {puzzle.hint_code}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingPuzzle(isEditing ? null : puzzle.id)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      {isEditing ? '접기' : '편집'}
                    </button>
                    <button
                      onClick={() => handleRemove(puzzle.id, puzzle.name)}
                      className="p-1 text-red-400 hover:bg-red-400/10 rounded"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                
                {isEditing && (
                  <div className="mt-3 space-y-2">
                    {hints.map(hint => (
                      <div key={hint.id} className="space-y-1">
                        <label className={`text-xs ${
                          hint.level === 1 ? 'text-emerald-400' :
                          hint.level === 2 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {hint.level}단계 ({hint.coin_cost === 0 ? '무료' : `코인 ${hint.coin_cost}개`})
                        </label>
                        <textarea
                          defaultValue={hint.content}
                          onBlur={(e) => {
                            if (e.target.value !== hint.content) {
                              handleUpdateHint(hint.id, e.target.value)
                            }
                          }}
                          className="input text-sm min-h-[80px]"
                          placeholder={`${hint.level}단계 힌트 내용`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
