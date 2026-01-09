// ========================================
// 코드 입력 모달 컴포넌트
// ========================================

import { useState, useEffect, useRef } from 'react'

interface CodeInputModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (code: string) => boolean
  title: string
  placeholder: string
  errorMessage: string
}

export function CodeInputModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder,
  errorMessage,
}: CodeInputModalProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isShaking, setIsShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    if (isOpen) {
      setCode('')
      setError('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode) {
      setError('코드를 입력해주세요')
      triggerShake()
      return
    }
    
    const success = onSubmit(trimmedCode)
    if (!success) {
      setError(errorMessage)
      triggerShake()
    }
  }
  
  const triggerShake = () => {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 300)
  }
  
  if (!isOpen) return null
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-4 text-center">{title}</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setError('')
            }}
            placeholder={placeholder}
            className={`input text-center text-xl tracking-wider uppercase ${isShaking ? 'shake' : ''}`}
            autoComplete="off"
            autoCapitalize="characters"
          />
          
          {error && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 px-4 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost flex-1"
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
            >
              확인
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

