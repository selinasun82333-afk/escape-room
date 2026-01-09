// ========================================
// Supabase 실시간 동기화 스토어
// 실제 Supabase 테이블 구조에 맞춤
// ========================================

import { create } from 'zustand'
import { supabase, DbEvent, DbTeam, DbStage, DbHint, DbTeamProgress, DbHintUsage } from '../lib/supabase'
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
  hints: DbHint[]
  teamProgress: DbTeamProgress[]
  hintUsage: DbHintUsage[]
  
  // 채널
  channel: RealtimeChannel | null
  
  // 초기화 및 구독
  initialize: () => Promise<void>
  refreshData: () => Promise<void>
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
  
  // 힌트 액션 (Admin CRUD)
  addHint: (hint: Omit<DbHint, 'id' | 'created_at'>) => Promise<void>
  updateHint: (hintId: string, updates: Partial<DbHint>) => Promise<void>
  deleteHint: (hintId: string) => Promise<void>
  getHintByCode: (code: string) => DbHint | undefined
  getHintsForPuzzle: (hintCode: string) => DbHint[]
  useHint: (teamId: string, hintId: string) => Promise<void>
  hasUsedHint: (teamId: string, hintId: string) => boolean
}

export const useSupabaseStore = create<SupabaseStore>((set, get) => ({
  isConnected: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  
  event: null,
  teams: [],
  stages: [],
  hints: [],
  teamProgress: [],
  hintUsage: [],
  
  channel: null,
  
  // 초기화 - 데이터 로드
  initialize: async () => {
    if (get().isInitialized || get().isLoading) return
    
    set({ isLoading: true, error: null })
    console.log('🔄 Initializing Supabase store...')
    
    try {
      // 이벤트 로드 시도
      const { data: events, error: eventError } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (eventError) {
        console.error('❌ Event load error:', eventError)
        throw new Error(`이벤트 로드 실패: ${eventError.message}`)
      }
      
      // 이벤트가 없으면 빈 상태로 초기화
      if (!events || events.length === 0) {
        console.log('📭 No events found in database')
        
        set({
          event: null,
          teams: [],
          stages: [],
          hints: [],
          teamProgress: [],
          hintUsage: [],
          isLoading: false,
          isConnected: true,
          isInitialized: true,
          error: '이벤트가 없습니다. Supabase에서 이벤트를 생성하세요.',
        })
        return
      }
      
      const currentEvent = events[0]
      console.log('📋 Loading event data:', currentEvent.id)
      
      // 관련 데이터 로드
      const [teamsRes, stagesRes, hintsRes, progressRes, usageRes] = await Promise.all([
        supabase.from('teams').select('*').eq('event_id', currentEvent.id),
        supabase.from('stages').select('*').eq('event_id', currentEvent.id),
        supabase.from('hints').select('*').eq('event_id', currentEvent.id),
        supabase.from('team_progress').select('*'),
        supabase.from('hint_usage').select('*'),
      ])
      
      set({
        event: currentEvent,
        teams: teamsRes.data || [],
        stages: stagesRes.data || [],
        hints: hintsRes.data || [],
        teamProgress: progressRes.data || [],
        hintUsage: usageRes.data || [],
        isLoading: false,
        isConnected: true,
        isInitialized: true,
        error: null,
      })
      
      console.log('✅ Supabase store initialized successfully')
      console.log(`   - Teams: ${teamsRes.data?.length || 0}`)
      console.log(`   - Stages: ${stagesRes.data?.length || 0}`)
      console.log(`   - Hints: ${hintsRes.data?.length || 0}`)
      
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
  
  // 데이터 새로고침
  refreshData: async () => {
    const { event } = get()
    console.log('🔄 Refreshing data...')
    
    if (!event) {
      set({ isInitialized: false })
      await get().initialize()
      return
    }
    
    try {
      const [eventRes, teamsRes, stagesRes, hintsRes, progressRes, usageRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', event.id).single(),
        supabase.from('teams').select('*').eq('event_id', event.id),
        supabase.from('stages').select('*').eq('event_id', event.id),
        supabase.from('hints').select('*').eq('event_id', event.id),
        supabase.from('team_progress').select('*'),
        supabase.from('hint_usage').select('*'),
      ])
      
      set({
        event: eventRes.data || event,
        teams: teamsRes.data || [],
        stages: stagesRes.data || [],
        hints: hintsRes.data || [],
        teamProgress: progressRes.data || [],
        hintUsage: usageRes.data || [],
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
        { event: '*', schema: 'public', table: 'hints', filter: `event_id=eq.${event.id}` },
        (payload) => {
          console.log('🔔 Hint change:', payload.eventType)
          const hints = get().hints
          if (payload.eventType === 'INSERT') {
            set({ hints: [...hints, payload.new as DbHint] })
          } else if (payload.eventType === 'UPDATE') {
            set({ hints: hints.map(h => h.id === payload.new.id ? payload.new as DbHint : h) })
          } else if (payload.eventType === 'DELETE') {
            set({ hints: hints.filter(h => h.id !== payload.old.id) })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_progress' },
        (payload) => {
          console.log('🔔 Progress:', payload)
          set({ teamProgress: [...get().teamProgress, payload.new as DbTeamProgress] })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hint_usage' },
        (payload) => {
          console.log('🔔 Hint usage:', payload)
          set({ hintUsage: [...get().hintUsage, payload.new as DbHintUsage] })
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
    
    set({ teams: get().teams.filter(t => t.id !== teamId) })
  },
  
  // 스테이지 진행 기록
  viewStage: async (teamId, stageId) => {
    if (get().hasViewedStage(teamId, stageId)) return
    
    console.log('👁️ Recording stage view:', { teamId, stageId })
    
    const { data, error } = await supabase
      .from('team_progress')
      .insert({ team_id: teamId, stage_id: stageId })
      .select()
      .single()
    
    if (error) {
      console.error('❌ View stage error:', error)
      return
    }
    
    if (data) {
      set({ teamProgress: [...get().teamProgress, data] })
    }
  },
  
  getStageByCode: (code) => {
    return get().stages.find(s => s.entry_code.toUpperCase() === code.toUpperCase())
  },
  
  hasViewedStage: (teamId, stageId) => {
    return get().teamProgress.some(p => p.team_id === teamId && p.stage_id === stageId)
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
      
      const { data: publicUrl } = supabase.storage
        .from('webtoons')
        .getPublicUrl(fileName)
      
      console.log('✅ Upload success:', publicUrl.publicUrl)
      
      await get().updateStage(stageId, { webtoon_image_url: publicUrl.publicUrl })
      
      return publicUrl.publicUrl
    } catch (error) {
      console.error('❌ uploadStageImage error:', error)
      throw error
    }
  },
  
  // 힌트 관련
  getHintByCode: (code) => {
    return get().hints.find(h => h.hint_code.toUpperCase() === code.toUpperCase())
  },
  
  getHintsForPuzzle: (hintCode) => {
    // 같은 hint_code를 가진 힌트들을 level 순으로 반환
    return get().hints
      .filter(h => h.hint_code.toUpperCase() === hintCode.toUpperCase())
      .sort((a, b) => a.level - b.level)
  },
  
  useHint: async (teamId, hintId) => {
    if (get().hasUsedHint(teamId, hintId)) return
    
    console.log('💡 Recording hint usage:', { teamId, hintId })
    
    const { data, error } = await supabase
      .from('hint_usage')
      .insert({ team_id: teamId, hint_id: hintId })
      .select()
      .single()
    
    if (error) {
      console.error('❌ Use hint error:', error)
      return
    }
    
    if (data) {
      set({ hintUsage: [...get().hintUsage, data] })
    }
  },
  
  hasUsedHint: (teamId, hintId) => {
    return get().hintUsage.some(u => u.team_id === teamId && u.hint_id === hintId)
  },
  
  // Admin: 힌트 추가
  addHint: async (hint) => {
    console.log('➕ Adding hint:', hint.name)
    
    const { data, error } = await supabase
      .from('hints')
      .insert(hint)
      .select()
      .single()
    
    if (error) {
      console.error('❌ Add hint error:', error)
      throw error
    }
    
    if (data) {
      set({ hints: [...get().hints, data] })
    }
  },
  
  // Admin: 힌트 수정
  updateHint: async (hintId, updates) => {
    console.log('📝 Updating hint:', hintId)
    
    const { error } = await supabase
      .from('hints')
      .update(updates)
      .eq('id', hintId)
    
    if (error) {
      console.error('❌ Update hint error:', error)
      throw error
    }
    
    set({
      hints: get().hints.map(h => h.id === hintId ? { ...h, ...updates } : h)
    })
  },
  
  // Admin: 힌트 삭제
  deleteHint: async (hintId) => {
    console.log('🗑️ Deleting hint:', hintId)
    
    const { error } = await supabase
      .from('hints')
      .delete()
      .eq('id', hintId)
    
    if (error) {
      console.error('❌ Delete hint error:', error)
      throw error
    }
    
    set({ hints: get().hints.filter(h => h.id !== hintId) })
  },
}))
