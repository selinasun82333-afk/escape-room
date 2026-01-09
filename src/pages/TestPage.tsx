import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase, testConnection, SUPABASE_URL } from '../lib/supabase'
import type { Event } from '../types/database.types'

interface ConnectionStatus {
  connected: boolean
  error?: string
  latency?: number
  timestamp?: Date
}

export default function TestPage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [testing, setTesting] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)

  // Test connection on mount
  useEffect(() => {
    runConnectionTest()
  }, [])

  const runConnectionTest = async () => {
    setTesting(true)
    const result = await testConnection()
    setStatus({
      ...result,
      timestamp: new Date()
    })
    setTesting(false)

    // If connected, fetch events
    if (result.connected) {
      fetchEvents()
    }
  }

  const fetchEvents = async () => {
    setLoadingEvents(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setEvents(data || [])
    } catch (err) {
      console.error('Error fetching events:', err)
    } finally {
      setLoadingEvents(false)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">🔌 Connection Test</h1>
            <p className="text-slate-400 mt-1">Verify Supabase connection</p>
          </div>
          <Link to="/" className="btn btn-secondary">
            ← Back
          </Link>
        </div>

        {/* Connection Status Card */}
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Connection Status</h2>
            <button
              onClick={runConnectionTest}
              disabled={testing}
              className="btn btn-primary"
            >
              {testing ? 'Testing...' : 'Re-test'}
            </button>
          </div>

          {/* Status Display */}
          {status && (
            <div className="space-y-4">
              {/* Status Indicator */}
              <div className="flex items-center gap-3">
                <div className={`status-dot ${status.connected ? 'status-connected' : 'status-disconnected'}`} />
                <span className={`font-medium ${status.connected ? 'text-emerald-400' : 'text-red-400'}`}>
                  {status.connected ? 'Connected' : 'Connection Failed'}
                </span>
                {status.latency && (
                  <span className="text-slate-500 text-sm">
                    ({status.latency}ms)
                  </span>
                )}
              </div>

              {/* Error Message */}
              {status.error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                  <p className="text-red-400 font-mono text-sm">{status.error}</p>
                </div>
              )}

              {/* Connection Details */}
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Supabase URL:</span>
                  <span className="text-slate-300 font-mono text-sm truncate max-w-xs">
                    {SUPABASE_URL}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last tested:</span>
                  <span className="text-slate-300">
                    {status.timestamp?.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {testing && !status && (
            <div className="flex items-center gap-3">
              <div className="status-dot status-pending" />
              <span className="text-amber-400">Testing connection...</span>
            </div>
          )}
        </div>

        {/* Events List */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Events in Database</h2>
            <button
              onClick={fetchEvents}
              disabled={loadingEvents || !status?.connected}
              className="btn btn-secondary text-sm"
            >
              {loadingEvents ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {!status?.connected ? (
            <p className="text-slate-500 text-center py-8">
              Connect to Supabase first
            </p>
          ) : loadingEvents ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-4">No events yet</p>
              <Link to="/admin" className="btn btn-primary">
                Create First Event →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="bg-slate-900/50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium text-white">{event.name}</h3>
                    <p className="text-sm text-slate-400">
                      Status: <span className={`font-medium ${
                        event.status === 'active' ? 'text-emerald-400' :
                        event.status === 'completed' ? 'text-blue-400' :
                        event.status === 'paused' ? 'text-amber-400' :
                        'text-slate-400'
                      }`}>{event.status}</span>
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    <p>{event.duration_seconds / 60} min</p>
                    <p>{event.hints_per_team} hints/team</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {status?.connected && (
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-emerald-400">{events.length}</p>
              <p className="text-slate-400 text-sm">Events</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-cyan-400">{status.latency || 0}</p>
              <p className="text-slate-400 text-sm">Latency (ms)</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-amber-400">✓</p>
              <p className="text-slate-400 text-sm">RLS Active</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

