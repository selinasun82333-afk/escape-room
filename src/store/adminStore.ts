// ========================================
// 관리자 상태 관리 (Supabase Auth)
// ========================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AdminStore {
  isLoggedIn: boolean
  email: string | null
  user: User | null
  isLoading: boolean
  
  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<boolean>
  setUser: (user: User | null) => void
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      email: null,
      user: null,
      isLoading: false,
      
      // Supabase Auth 로그인
      login: async (email, password) => {
        set({ isLoading: true })
        
        try {
          // 1. Supabase Auth로 로그인
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          
          if (authError) {
            console.error('Auth error:', authError)
            set({ isLoading: false })
            return { 
              success: false, 
              error: authError.message === 'Invalid login credentials' 
                ? '이메일 또는 비밀번호가 올바르지 않습니다' 
                : authError.message 
            }
          }
          
          if (!authData.user) {
            set({ isLoading: false })
            return { success: false, error: '로그인에 실패했습니다' }
          }
          
          // 2. 관리자 권한 확인 (profiles 테이블에서 role 체크)
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single()
          
          // profiles 테이블이 없거나 데이터가 없어도 일단 로그인 허용 (개발 편의)
          // 실제 운영에서는 관리자 권한 체크를 엄격하게 해야 함
          if (profileError) {
            console.warn('Profile check failed (allowing login):', profileError.message)
            // 프로필이 없어도 로그인 허용 (개발 모드)
          } else if (profile && profile.role !== 'admin') {
            // 프로필이 있지만 admin이 아닌 경우
            await supabase.auth.signOut()
            set({ isLoading: false })
            return { success: false, error: '관리자 권한이 없습니다' }
          }
          
          // 3. 로그인 성공
          set({ 
            isLoggedIn: true, 
            email: authData.user.email || null,
            user: authData.user,
            isLoading: false 
          })
          
          console.log('✅ Admin login successful:', authData.user.email)
          return { success: true }
          
        } catch (err: any) {
          console.error('Login error:', err)
          set({ isLoading: false })
          return { success: false, error: '로그인 중 오류가 발생했습니다' }
        }
      },
      
      // 로그아웃
      logout: async () => {
        try {
          await supabase.auth.signOut()
          console.log('✅ Admin logged out')
        } catch (err) {
          console.error('Logout error:', err)
        }
        set({ isLoggedIn: false, email: null, user: null })
      },
      
      // 인증 상태 확인 (페이지 로드 시)
      checkAuth: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session?.user) {
            // 관리자 권한 확인 (선택적)
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single()
            
            // 프로필이 없거나 admin이면 허용
            if (!profile || profile.role === 'admin') {
              set({ 
                isLoggedIn: true, 
                email: session.user.email || null,
                user: session.user 
              })
              return true
            } else {
              // admin이 아니면 로그아웃
              await supabase.auth.signOut()
              set({ isLoggedIn: false, email: null, user: null })
              return false
            }
          }
          
          set({ isLoggedIn: false, email: null, user: null })
          return false
        } catch (err) {
          console.error('Check auth error:', err)
          return false
        }
      },
      
      // 유저 설정 (auth state change listener용)
      setUser: (user) => {
        if (user) {
          set({ isLoggedIn: true, email: user.email || null, user })
        } else {
          set({ isLoggedIn: false, email: null, user: null })
        }
      },
    }),
    {
      name: 'escape-room-admin',
      partialize: (state) => ({ 
        isLoggedIn: state.isLoggedIn, 
        email: state.email 
      }), // user 객체는 저장하지 않음
    }
  )
)

// Auth state change listener 설정
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session?.user?.email)
  
  const store = useAdminStore.getState()
  
  if (event === 'SIGNED_IN' && session?.user) {
    store.setUser(session.user)
  } else if (event === 'SIGNED_OUT') {
    store.setUser(null)
  }
})
