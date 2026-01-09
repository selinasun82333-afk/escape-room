// ========================================
// QR 스캐너 컴포넌트
// ========================================

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QRScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (code: string) => boolean
  title: string
  placeholder: string
  errorMessage: string
}

export function QRScanner({
  isOpen,
  onClose,
  onScan,
  title,
  placeholder,
  errorMessage,
}: QRScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 카메라 스캐너 시작
  useEffect(() => {
    if (!isOpen || mode !== 'camera') return
    
    const startScanner = async () => {
      try {
        setIsScanning(true)
        setCameraError('')
        
        const scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner
        
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // QR 코드 스캔 성공
            handleScan(decodedText.toUpperCase())
          },
          () => {
            // QR 코드 인식 실패 (무시)
          }
        )
      } catch (err: any) {
        console.error('Camera error:', err)
        setCameraError('카메라를 사용할 수 없습니다')
        setMode('manual')
      } finally {
        setIsScanning(false)
      }
    }
    
    startScanner()
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [isOpen, mode])
  
  // 모달 닫힐 때 정리
  useEffect(() => {
    if (!isOpen) {
      setCode('')
      setError('')
      setCameraError('')
      setMode('camera')
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [isOpen])
  
  const handleScan = (scannedCode: string) => {
    const success = onScan(scannedCode)
    if (!success) {
      setError(errorMessage)
      // 진동 피드백 (모바일)
      if (navigator.vibrate) {
        navigator.vibrate(200)
      }
    }
  }
  
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode) {
      setError('코드를 입력해주세요')
      return
    }
    handleScan(trimmedCode)
  }
  
  const switchToManual = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setMode('manual')
  }
  
  if (!isOpen) return null
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content max-w-md" 
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4 text-center">{title}</h3>
        
        {mode === 'camera' ? (
          <>
            {/* QR 스캐너 영역 */}
            <div className="relative mb-4">
              <div 
                id="qr-reader" 
                ref={containerRef}
                className="w-full aspect-square bg-black rounded-xl overflow-hidden"
              />
              
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-white text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                    <span>카메라 로딩 중...</span>
                  </div>
                </div>
              )}
              
              {/* 스캔 가이드 오버레이 */}
              {!isScanning && !cameraError && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-indigo-400 rounded-lg relative">
                      {/* 코너 강조 */}
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr" />
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {cameraError && (
              <div className="text-amber-400 text-sm text-center mb-4 bg-amber-500/10 py-2 px-4 rounded-lg">
                {cameraError}
              </div>
            )}
            
            <p className="text-slate-400 text-sm text-center mb-4">
              QR 코드를 화면 중앙에 위치시켜주세요
            </p>
            
            <button
              onClick={switchToManual}
              className="btn btn-ghost w-full mb-2"
            >
              📝 코드 직접 입력
            </button>
          </>
        ) : (
          <>
            {/* 수동 입력 모드 */}
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase())
                  setError('')
                }}
                placeholder={placeholder}
                className="input text-center text-xl tracking-wider uppercase"
                autoComplete="off"
                autoCapitalize="characters"
                autoFocus
              />
              
              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 px-4 rounded-lg">
                  {error}
                </div>
              )}
              
              <button type="submit" className="btn btn-primary w-full">
                확인
              </button>
            </form>
            
            <button
              onClick={() => setMode('camera')}
              className="btn btn-ghost w-full mt-2"
            >
              📷 QR 스캔으로 돌아가기
            </button>
          </>
        )}
        
        <button
          onClick={onClose}
          className="btn btn-ghost w-full mt-2"
        >
          취소
        </button>
      </div>
    </div>
  )
}

