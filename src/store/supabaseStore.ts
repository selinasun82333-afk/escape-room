// ========================================
// Supabase 실시간 동기화 스토어
// ========================================

import { create } from 'zustand'
import { supabase, DbEvent, DbTeam, DbStage, DbPuzzle, DbPuzzleHint, DbTeamStageView, DbTeamHintUsage } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface SupabaseStore {
  // 연결 상태
  isConnected: boolean
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  
  // 데이터
  event: DbEvent | null
  teams: DbTeam[]
  stages: DbStage[]
  puzzles: DbPuzzle[]
  puzzleHints: DbPuzzleHint[]
  stageViews: DbTeamStageView[]
  hintUsages: DbTeamHintUsage[]
  
  // 채널
  channel: RealtimeChannel | null
  
  // 초기화 및 구독
  initialize: () => Promise<void>
  refreshData: () => Promise<void>
  createSeedData: () => Promise<string | null>
  subscribe: () => void
  unsubscribe: () => void
  
  // 이벤트 액션
  updateEvent: (updates: Partial<DbEvent>) => Promise<void>
  startTimer: () => Promise<void>
  pauseTimer: () => Promise<void>
  resumeTimer: () => Promise<void>
  resetTimer: () => Promise<void>
  
  // 팀 액션 (Admin CRUD)
  addTeam: (team: Omit<DbTeam, 'id' | 'created_at'>) => Promise<void>
  updateTeam: (teamId: string, updates: Partial<DbTeam>) => Promise<void>
  deleteTeam: (teamId: string) => Promise<void>
  useHintCoin: (teamId: string, cost: number) => Promise<boolean>
  getTeamByCode: (code: string) => DbTeam | undefined
  
  // 스테이지 액션 (Admin CRUD)
  addStage: (stage: Omit<DbStage, 'id' | 'created_at'>) => Promise<void>
  updateStage: (stageId: string, updates: Partial<DbStage>) => Promise<void>
  deleteStage: (stageId: string) => Promise<void>
  uploadStageImage: (stageId: string, file: File) => Promise<string | null>
  viewStage: (teamId: string, stageId: string) => Promise<void>
  getStageByCode: (code: string) => DbStage | undefined
  hasViewedStage: (teamId: string, stageId: string) => boolean
  
  // 퍼즐/힌트 액션 (Admin CRUD)
  addPuzzle: (puzzle: Omit<DbPuzzle, 'id' | 'created_at'>) => Promise<string | null>
  updatePuzzle: (puzzleId: string, updates: Partial<DbPuzzle>) => Promise<void>
  deletePuzzle: (puzzleId: string) => Promise<void>
  addPuzzleHint: (hint: Omit<DbPuzzleHint, 'id' | 'created_at'>) => Promise<void>
  updatePuzzleHint: (hintId: string, updates: Partial<DbPuzzleHint>) => Promise<void>
  deletePuzzleHint: (hintId: string) => Promise<void>
  getPuzzleByCode: (code: string) => DbPuzzle | undefined
  getHintsForPuzzle: (puzzleId: string) => DbPuzzleHint[]
  useHint: (teamId: string, puzzleHintId: string) => Promise<void>
  hasUsedHint: (teamId: string, puzzleHintId: string) => boolean
}

export const useSupabaseStore = create<SupabaseStore>((set, get) => ({
  isConnected: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  
  event: null,
  teams: [],
  stages: [],
  puzzles: [],
  puzzleHints: [],
  stageViews: [],
  hintUsages: [],
  
  channel: null,
  
  // Supabase에 시드 데이터 생성
  createSeedData: async () => {
    console.log('🌱 Creating seed data in Supabase...')
    
    try {
      // 1. 이벤트 생성
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({
          name: '방탈출 게임',
          duration_minutes: 60,
          status: 'waiting',
          hints_per_team: 5,
          paused_duration: 0,
        })
        .select()
        .single()
      
      if (eventError) {
        console.error('❌ Event creation failed:', eventError)
        throw eventError
      }
      
      console.log('✅ Event created:', newEvent.id)
      return newEvent.id
      
    } catch (err: any) {
      console.error('❌ Seed data creation failed:', err)
      set({ error: err.message })
      return null
    }
  },
  
  // 초기화 - 데이터 로드
  initialize: async () => {
    if (get().isInitialized || get().isLoading) return
    
    set({ isLoading: true, error: null })
    console.log('🔄 Initializing Supabase store...')
    
    try {
      // 이벤트 로드 시도
      let { data: events, error: eventError } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (eventError) {
        console.error('❌ Event load error:', eventError)
        throw new Error(`이벤트 로드 실패: ${eventError.message}`)
      }
      
      let currentEvent: DbEvent
      
      // 이벤트가 없으면 시드 데이터 생성
      if (!events || events.length === 0) {
        console.log('📭 No events found, creating seed data...')
        const newEventId = await get().createSeedData()
        
        if (!newEventId) {
          throw new Error('시드 데이터 생성 실패')
        }
        
        // 새로 생성된 이벤트 로드
        const { data: newEvent, error: newEventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', newEventId)
          .single()
        
        if (newEventError || !newEvent) {
          throw new Error('새 이벤트 로드 실패')
        }
        
        currentEvent = newEvent
      } else {
        currentEvent = events[0]
      }
      
      console.log('📋 Loading event data:', currentEvent.id)
      
      // 관련 데이터 로드
      const [teamsRes, stagesRes, puzzlesRes, viewsRes, usagesRes] = await Promise.all([
        supabase.from('teams').select('*').eq('event_id', currentEvent.id),
        supabase.from('stages').select('*').eq('event_id', currentEvent.id),
        supabase.from('puzzles').select('*').eq('event_id', currentEvent.id),
        supabase.from('team_stage_views').select('*'),
        supabase.from('team_hint_usage').select('*'),
      ])
      
      // 퍼즐 ID 목록
      const puzzleIds = puzzlesRes.data?.map(p => p.id) || []
      
      // 힌트 로드 (해당 퍼즐들의 힌트만)
      let hintsData: DbPuzzleHint[] = []
      if (puzzleIds.length > 0) {
        const { data: hints } = await supabase
          .from('puzzle_hints')
          .select('*')
          .in('puzzle_id', puzzleIds)
        hintsData = hints || []
      }
      
      set({
        event: currentEvent,
        teams: teamsRes.data || [],
        stages: stagesRes.data || [],
        puzzles: puzzlesRes.data || [],
        puzzleHints: hintsData,
        stageViews: viewsRes.data || [],
        hintUsages: usagesRes.data || [],
        isLoading: false,
        isConnected: true,
        isInitialized: true,
        error: null,
      })
      
      console.log('✅ Supabase store initialized successfully')
      console.log(`   - Teams: ${teamsRes.data?.length || 0}`)
      console.log(`   - Stages: ${stagesRes.data?.length || 0}`)
      console.log(`   - Puzzles: ${puzzlesRes.data?.length || 0}`)
      
      // 실시간 구독 시작
      get().subscribe()
      
    } catch (err: any) {
      console.error('❌ Supabase initialize error:', err)
      set({
        error: err.message || '연결 실패',
        isLoading: false,
        isConnected: false,
        isInitialized: true,
      })
    }
  },
  
  // 데이터 새로고침 (강제)
  refreshData: async () => {
    const { event } = get()
    console.log('🔄 Refreshing data...')
    
    if (!event) {
      set({ isInitialized: false })
      await get().initialize()
      return
    }
    
    try {
      const [
        eventRes,
        teamsRes, 
        stagesRes, 
        puzzlesRes, 
        viewsRes, 
        usagesRes
      ] = await Promise.all([
        supabase.from('events').select('*').eq('id', event.id).single(),
        supabase.from('teams').select('*').eq('event_id', event.id),
        supabase.from('stages').select('*').eq('event_id', event.id),
        supabase.from('puzzles').select('*').eq('event_id', event.id),
        supabase.from('team_stage_views').select('*'),
        supabase.from('team_hint_usage').select('*'),
      ])
      
      // 힌트 로드
      const puzzleIds = puzzlesRes.data?.map(p => p.id) || []
      let hintsData: DbPuzzleHint[] = []
      if (puzzleIds.length > 0) {
        const { data: hints } = await supabase
          .from('puzzle_hints')
          .select('*')
          .in('puzzle_id', puzzleIds)
        hintsData = hints || []
      }
      
      set({
        event: eventRes.data || event,
        teams: teamsRes.data || [],
        stages: stagesRes.data || [],
        puzzles: puzzlesRes.data || [],
        puzzleHints: hintsData,
        stageViews: viewsRes.data || [],
        hintUsages: usagesRes.data || [],
      })
      
      console.log('✅ Data refreshed')
    } catch (err: any) {
      console.error('❌ Refresh error:', err)
    }
  },
  
  // 실시간 구독
  subscribe: () => {
    const { event, channel: existingChannel } = get()
    if (!event) return
    
    // 기존 채널이 있으면 제거
    if (existingChannel) {
      supabase.removeChannel(existingChannel)
    }
    
    console.log('📡 Setting up realtime subscription...')
    
    const channel = supabase
      .channel('game-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `id=eq.${event.id}` },
        (payload) => {
          console.log('🔔 Event change:', payload.eventType)
          if (payload.eventType === 'UPDATE') {
            set({ event: payload.new as DbEvent })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `event_id=eq.${event.id}` },
        (payload) => {
          console.log('🔔 Team change:', payload.eventType)
          const teams = get().teams
          if (payload.eventType === 'INSERT') {
            set({ teams: [...teams, payload.new as DbTeam] })
          } else if (payload.eventType === 'UPDATE') {
            set({ teams: teams.map(t => t.id === payload.new.id ? payload.new as DbTeam : t) })
          } else if (payload.eventType === 'DELETE') {
            set({ teams: teams.filter(t => t.id !== payload.old.id) })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stages', filter: `event_id=eq.${event.id}` },
        (payload) => {
          console.log('🔔 Stage change:', payload.eventType)
          const stages = get().stages
          if (payload.eventType === 'INSERT') {
            set({ stages: [...stages, payload.new as DbStage] })
          } else if (payload.eventType === 'UPDATE') {
            set({ stages: stages.map(s => s.id === payload.new.id ? payload.new as DbStage : s) })
          } else if (payload.eventType === 'DELETE') {
            set({ stages: stages.filter(s => s.id !== payload.old.id) })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'puzzles', filter: `event_id=eq.${event.id}` },
        (payload) => {
          console.log('🔔 Puzzle change:', payload.eventType)
          const puzzles = get().puzzles
          if (payload.eventType === 'INSERT') {
            set({ puzzles: [...puzzles, payload.new as DbPuzzle] })
          } else if (payload.eventType === 'UPDATE') {
            set({ puzzles: puzzles.map(p => p.id === payload.new.id ? payload.new as DbPuzzle : p) })
          } else if (payload.eventType === 'DELETE') {
            set({ puzzles: puzzles.filter(p => p.id !== payload.old.id) })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'puzzle_hints' },
        (payload) => {
          console.log('🔔 Hint change:', payload.eventType)
          const hints = get().puzzleHints
          if (payload.eventType === 'INSERT') {
            set({ puzzleHints: [...hints, payload.new as DbPuzzleHint] })
          } else if (payload.eventType === 'UPDATE') {
            set({ puzzleHints: hints.map(h => h.id === payload.new.id ? payload.new as DbPuzzleHint : h) })
          } else if (payload.eventType === 'DELETE') {
            set({ puzzleHints: hints.filter(h => h.id !== payload.old.id) })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_stage_views' },
        (payload) => {
          console.log('🔔 Stage view:', payload)
          set({ stageViews: [...get().stageViews, payload.new as DbTeamStageView] })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_hint_usage' },
        (payload) => {
          console.log('🔔 Hint usage:', payload)
          set({ hintUsages: [...get().hintUsages, payload.new as DbTeamHintUsage] })
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status)
      })
    
    set({ channel })
  },
  
  unsubscribe: () => {
    const { channel } = get()
    if (channel) {
      supabase.removeChannel(channel)
      set({ channel: null })
    }
  },
  
  // 이벤트 업데이트
  updateEvent: async (updates) => {
    const { event } = get()
    if (!event) return
    
    console.log('📝 Updating event:', updates)
    
    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', event.id)
    
    if (error) {
      console.error('❌ Update event error:', error)
      throw error
    }
    
    // 로컬 상태도 즉시 업데이트 (Realtime이 늦을 수 있음)
    set({ event: { ...event, ...updates } as DbEvent })
  },
  
  startTimer: async () => {
    console.log('▶️ Starting timer')
    await get().updateEvent({
      status: 'running',
      started_at: new Date().toISOString(),
      paused_at: null,
      paused_duration: 0,
    })
  },
  
  pauseTimer: async () => {
    console.log('⏸️ Pausing timer')
    await get().updateEvent({
      status: 'paused',
      paused_at: new Date().toISOString(),
    })
  },
  
  resumeTimer: async () => {
    const { event } = get()
    if (!event || !event.paused_at) return
    
    console.log('▶️ Resuming timer')
    const pausedDuration = (event.paused_duration || 0) + 
      (new Date().getTime() - new Date(event.paused_at).getTime())
    
    await get().updateEvent({
      status: 'running',
      paused_at: null,
      paused_duration: pausedDuration,
    })
  },
  
  resetTimer: async () => {
    console.log('🔄 Resetting timer')
    await get().updateEvent({
      status: 'waiting',
      started_at: null,
      paused_at: null,
      paused_duration: 0,
    })
  },
  
  // 힌트 코인 사용
  useHintCoin: async (teamId, cost) => {
    const team = get().teams.find(t => t.id === teamId)
    if (!team || team.hints_remaining < cost) return false
    
    console.log('🪙 Using hint coin:', { teamId, cost })
    
    const { error } = await supabase
      .from('teams')
      .update({ hints_remaining: team.hints_remaining - cost })
      .eq('id', teamId)
    
    if (error) {
      console.error('❌ Use hint coin error:', error)
      return false
    }
    
    // 로컬 상태도 즉시 업데이트
    set({
      teams: get().teams.map(t => 
        t.id === teamId ? { ...t, hints_remaining: t.hints_remaining - cost } : t
      )
    })
    
    return true
  },
  
  getTeamByCode: (code) => {
    return get().teams.find(t => t.join_code.toUpperCase() === code.toUpperCase())
  },
  
  // Admin: 팀 추가
  addTeam: async (team) => {
    console.log('➕ Adding team:', team.name)
    
    const { data, error } = await supabase
      .from('teams')
      .insert(team)
      .select()
      .single()
    
    if (error) {
      console.error('❌ Add team error:', error)
      throw error
    }
    
    // 로컬 상태도 즉시 업데이트
    if (data) {
      set({ teams: [...get().teams, data] })
    }
  },
  
  // Admin: 팀 수정
  updateTeam: async (teamId, updates) => {
    console.log('📝 Updating team:', teamId)
    
    const { error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId)
    
    if (error) {
      console.error('❌ Update team error:', error)
      throw error
    }
    
    // 로컬 상태도 즉시 업데이트
    set({
      teams: get().teams.map(t => t.id === teamId ? { ...t, ...updates } : t)
    })
  },
  
  // Admin: 팀 삭제
  deleteTeam: async (teamId) => {
    console.log('🗑️ Deleting team:', teamId)
    
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId)
    
    if (error) {
      console.error('❌ Delete team error:', error)
      throw error
    }
    
    // 로컬 상태도 즉시 업데이트
    set({ teams: get().teams.filter(t => t.id !== teamId) })
  },
  
  // 스테이지 조회 기록
  viewStage: async (teamId, stageId) => {
    if (get().hasViewedStage(teamId, stageId)) return
    
    console.log('👁️ Recording stage view:', { teamId, stageId })
    
    const { data, error } = await supabase
      .from('team_stage_views')
      .insert({ team_id: teamId, stage_id: stageId })
      .select()
      .single()
    
    if (error) {
      console.error('❌ View stage error:', error)
      return
    }
    
    if (data) {
      set({ stageViews: [...get().stageViews, data] })
    }
  },
  
  getStageByCode: (code) => {
    return get().stages.find(s => s.entry_code.toUpperCase() === code.toUpperCase())
  },
  
  hasViewedStage: (teamId, stageId) => {
    return get().stageViews.some(sv => sv.team_id === teamId && sv.stage_id === stageId)
  },
  
  // Admin: 스테이지 추가
  addStage: async (stage) => {
    console.log('➕ Adding stage:', stage.name)
    
    const { data, error } = await supabase
      .from('stages')
      .insert(stage)
      .select()
      .single()
    
    if (error) {
      console.error('❌ Add stage error:', error)
      throw error
    }
    
    if (data) {
      set({ stages: [...get().stages, data] })
    }
  },
  
  // Admin: 스테이지 수정
  updateStage: async (stageId, updates) => {
    console.log('📝 Updating stage:', stageId)
    
    const { error } = await supabase
      .from('stages')
      .update(updates)
      .eq('id', stageId)
    
    if (error) {
      console.error('❌ Update stage error:', error)
      throw error
    }
    
    set({
      stages: get().stages.map(s => s.id === stageId ? { ...s, ...updates } : s)
    })
  },
  
  // Admin: 스테이지 삭제
  deleteStage: async (stageId) => {
    console.log('🗑️ Deleting stage:', stageId)
    
    // 이미지도 삭제 시도
    try {
      await supabase.storage.from('webtoons').remove([`${stageId}`])
    } catch (e) {
      console.warn('Image delete warning:', e)
    }
    
    const { error } = await supabase
      .from('stages')
      .delete()
      .eq('id', stageId)
    
    if (error) {
      console.error('❌ Delete stage error:', error)
      throw error
    }
    
    set({ stages: get().stages.filter(s => s.id !== stageId) })
  },
  
  // Admin: 스테이지 이미지 업로드
  uploadStageImage: async (stageId, file) => {
    console.log('📤 Uploading image:', { stageId, fileName: file.name })
    
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${stageId}/${Date.now()}.${fileExt}`
      
      // 기존 이미지 삭제 시도
      try {
        const { data: existingFiles } = await supabase.storage
          .from('webtoons')
          .list(stageId)
        
        if (existingFiles && existingFiles.length > 0) {
          await supabase.storage
            .from('webtoons')
            .remove(existingFiles.map(f => `${stageId}/${f.name}`))
        }
      } catch (e) {
        console.warn('Existing image cleanup warning:', e)
      }
      
      // 새 이미지 업로드
      const { error: uploadError } = await supabase.storage
        .from('webtoons')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        })
      
      if (uploadError) {
        console.error('❌ Upload error:', uploadError)
        throw uploadError
      }
      
      // Public URL 생성
      const { data: publicUrl } = supabase.storage
        .from('webtoons')
        .getPublicUrl(fileName)
      
      console.log('✅ Upload success:', publicUrl.publicUrl)
      
      // DB 업데이트
      await get().updateStage(stageId, { webtoon_image_url: publicUrl.publicUrl })
      
      return publicUrl.publicUrl
    } catch (error) {
      console.error('❌ uploadStageImage error:', error)
      throw error
    }
  },
  
  // 퍼즐/힌트
  getPuzzleByCode: (code) => {
    return get().puzzles.find(p => p.hint_code.toUpperCase() === code.toUpperCase())
  },
  
  getHintsForPuzzle: (puzzleId) => {
    return get().puzzleHints
      .filter(h => h.puzzle_id === puzzleId)
      .sort((a, b) => a.level - b.level)
  },
  
  useHint: async (teamId, puzzleHintId) => {
    if (get().hasUsedHint(teamId, puzzleHintId)) return
    
    console.log('💡 Recording hint usage:', { teamId, puzzleHintId })
    
    const { data, error } = await supabase
      .from('team_hint_usage')
      .insert({ team_id: teamId, puzzle_hint_id: puzzleHintId })
      .select()
      .single()
    
    if (error) {
      console.error('❌ Use hint error:', error)
      return
    }
    
    if (data) {
      set({ hintUsages: [...get().hintUsages, data] })
    }
  },
  
  hasUsedHint: (teamId, puzzleHintId) => {
    return get().hintUsages.some(hu => hu.team_id === teamId && hu.puzzle_hint_id === puzzleHintId)
  },
  
  // Admin: 퍼즐 추가
  addPuzzle: async (puzzle) => {
    console.log('➕ Adding puzzle:', puzzle.name)
    
    const { data, error } = await supabase
      .from('puzzles')
      .insert(puzzle)
      .select()
      .single()
    
    if (error) {
      console.error('❌ Add puzzle error:', error)
      throw error
    }
    
    if (data) {
      set({ puzzles: [...get().puzzles, data] })
      
      // 기본 힌트 3개 추가
      const defaultHints = [
        { puzzle_id: data.id, level: 1, content: '1단계 힌트를 입력하세요', coin_cost: 0 },
        { puzzle_id: data.id, level: 2, content: '2단계 힌트를 입력하세요', coin_cost: 1 },
        { puzzle_id: data.id, level: 3, content: '3단계 힌트를 입력하세요', coin_cost: 2 },
      ]
      
      const { data: hintsData, error: hintsError } = await supabase
        .from('puzzle_hints')
        .insert(defaultHints)
        .select()
      
      if (!hintsError && hintsData) {
        set({ puzzleHints: [...get().puzzleHints, ...hintsData] })
      }
      
      return data.id
    }
    
    return null
  },
  
  // Admin: 퍼즐 수정
  updatePuzzle: async (puzzleId, updates) => {
    console.log('📝 Updating puzzle:', puzzleId)
    
    const { error } = await supabase
      .from('puzzles')
      .update(updates)
      .eq('id', puzzleId)
    
    if (error) {
      console.error('❌ Update puzzle error:', error)
      throw error
    }
    
    set({
      puzzles: get().puzzles.map(p => p.id === puzzleId ? { ...p, ...updates } : p)
    })
  },
  
  // Admin: 퍼즐 삭제
  deletePuzzle: async (puzzleId) => {
    console.log('🗑️ Deleting puzzle:', puzzleId)
    
    const { error } = await supabase
      .from('puzzles')
      .delete()
      .eq('id', puzzleId)
    
    if (error) {
      console.error('❌ Delete puzzle error:', error)
      throw error
    }
    
    set({ 
      puzzles: get().puzzles.filter(p => p.id !== puzzleId),
      puzzleHints: get().puzzleHints.filter(h => h.puzzle_id !== puzzleId)
    })
  },
  
  // Admin: 힌트 추가
  addPuzzleHint: async (hint) => {
    console.log('➕ Adding hint')
    
    const { data, error } = await supabase
      .from('puzzle_hints')
      .insert(hint)
      .select()
      .single()
    
    if (error) {
      console.error('❌ Add hint error:', error)
      throw error
    }
    
    if (data) {
      set({ puzzleHints: [...get().puzzleHints, data] })
    }
  },
  
  // Admin: 힌트 수정
  updatePuzzleHint: async (hintId, updates) => {
    console.log('📝 Updating hint:', hintId)
    
    const { error } = await supabase
      .from('puzzle_hints')
      .update(updates)
      .eq('id', hintId)
    
    if (error) {
      console.error('❌ Update hint error:', error)
      throw error
    }
    
    set({
      puzzleHints: get().puzzleHints.map(h => h.id === hintId ? { ...h, ...updates } : h)
    })
  },
  
  // Admin: 힌트 삭제
  deletePuzzleHint: async (hintId) => {
    console.log('🗑️ Deleting hint:', hintId)
    
    const { error } = await supabase
      .from('puzzle_hints')
      .delete()
      .eq('id', hintId)
    
    if (error) {
      console.error('❌ Delete hint error:', error)
      throw error
    }
    
    set({ puzzleHints: get().puzzleHints.filter(h => h.id !== hintId) })
  },
}))
