import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface CreatedEvent {
  id: string
  name: string
}

interface CreatedStage {
  id: string
  name: string
  unlock_code: string
}

interface CreatedTeam {
  id: string
  name: string
  join_code: string
}

export default function AdminPage() {
  // Form states
  const [eventName, setEventName] = useState('Test Escape Room')
  const [eventDuration, setEventDuration] = useState(60)
  const [hintsPerTeam, setHintsPerTeam] = useState(3)
  
  const [stageName, setStageName] = useState('Stage 1: The Beginning')
  const [stageCode, setStageCode] = useState('SECRET123')
  const [stageDescription, setStageDescription] = useState('Find the hidden code to proceed.')
  
  const [teamName, setTeamName] = useState('Team Alpha')
  
  // Created items
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null)
  const [createdStage, setCreatedStage] = useState<CreatedStage | null>(null)
  const [createdTeam, setCreatedTeam] = useState<CreatedTeam | null>(null)
  
  // Loading/error states
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const showMessage = (type: 'error' | 'success', message: string) => {
    if (type === 'error') {
      setError(message)
      setSuccess(null)
    } else {
      setSuccess(message)
      setError(null)
    }
    setTimeout(() => {
      setError(null)
      setSuccess(null)
    }, 5000)
  }

  // Create Event
  const createEvent = async () => {
    setLoading('event')
    setError(null)
    
    try {
      // First, we need to create a profile for the admin if using auth
      // For now, we'll create the event directly (assuming RLS allows it or we're using service key)
      
      const { data, error } = await supabase
        .from('events')
        .insert({
          name: eventName,
          duration_seconds: eventDuration * 60,
          hints_per_team: hintsPerTeam,
          status: 'scheduled',
          max_team_size: 6,
          allow_late_join: true,
        })
        .select()
        .single()

      if (error) throw error
      
      setCreatedEvent({ id: data.id, name: data.name })
      showMessage('success', `Event "${data.name}" created!`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create event'
      showMessage('error', message)
      console.error('Create event error:', err)
    } finally {
      setLoading(null)
    }
  }

  // Create Stage
  const createStage = async () => {
    if (!createdEvent) {
      showMessage('error', 'Create an event first!')
      return
    }
    
    setLoading('stage')
    
    try {
      const { data, error } = await supabase
        .from('stages')
        .insert({
          event_id: createdEvent.id,
          order_index: 0,
          name: stageName,
          description: stageDescription,
          unlock_code: stageCode.toUpperCase(),
          base_points: 100,
          time_bonus_enabled: true,
        })
        .select()
        .single()

      if (error) throw error
      
      setCreatedStage({ 
        id: data.id, 
        name: data.name,
        unlock_code: data.unlock_code 
      })
      showMessage('success', `Stage "${data.name}" created!`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create stage'
      showMessage('error', message)
      console.error('Create stage error:', err)
    } finally {
      setLoading(null)
    }
  }

  // Create Team
  const createTeam = async () => {
    if (!createdEvent) {
      showMessage('error', 'Create an event first!')
      return
    }
    
    setLoading('team')
    
    try {
      // Generate a random 6-character join code
      const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      
      const { data, error } = await supabase
        .from('teams')
        .insert({
          event_id: createdEvent.id,
          name: teamName,
          join_code: joinCode,
          hints_remaining: hintsPerTeam,
        })
        .select()
        .single()

      if (error) throw error
      
      setCreatedTeam({ 
        id: data.id, 
        name: data.name,
        join_code: data.join_code 
      })
      showMessage('success', `Team "${data.name}" created with code: ${data.join_code}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create team'
      showMessage('error', message)
      console.error('Create team error:', err)
    } finally {
      setLoading(null)
    }
  }

  // Reset all
  const resetAll = () => {
    setCreatedEvent(null)
    setCreatedStage(null)
    setCreatedTeam(null)
    setError(null)
    setSuccess(null)
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">⚙️ Admin Setup</h1>
            <p className="text-slate-400 mt-1">Create test data to verify database</p>
          </div>
          <div className="flex gap-2">
            <button onClick={resetAll} className="btn btn-secondary">
              Reset
            </button>
            <Link to="/test" className="btn btn-secondary">
              Test Page
            </Link>
            <Link to="/" className="btn btn-secondary">
              ← Back
            </Link>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4 mb-6">
            <p className="text-emerald-400">{success}</p>
          </div>
        )}

        {/* Note about RLS */}
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 mb-6">
          <p className="text-amber-300 text-sm">
            <strong>Note:</strong> If you get permission errors, you may need to:
            <br />1. Sign in as an admin user, or
            <br />2. Temporarily disable RLS on the tables for testing
          </p>
        </div>

        <div className="grid gap-6">
          {/* Step 1: Create Event */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                createdEvent ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}>
                {createdEvent ? '✓' : '1'}
              </div>
              <h2 className="text-xl font-semibold text-white">Create Event</h2>
            </div>

            {createdEvent ? (
              <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                <p className="text-emerald-300">
                  <strong>Created:</strong> {createdEvent.name}
                </p>
                <p className="text-slate-400 text-sm font-mono mt-1">
                  ID: {createdEvent.id}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Event Name</label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    className="input"
                    placeholder="My Escape Room"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 text-sm mb-1">Duration (minutes)</label>
                    <input
                      type="number"
                      value={eventDuration}
                      onChange={(e) => setEventDuration(parseInt(e.target.value) || 60)}
                      className="input"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm mb-1">Hints per Team</label>
                    <input
                      type="number"
                      value={hintsPerTeam}
                      onChange={(e) => setHintsPerTeam(parseInt(e.target.value) || 3)}
                      className="input"
                      min={0}
                    />
                  </div>
                </div>
                <button
                  onClick={createEvent}
                  disabled={loading === 'event' || !eventName}
                  className="btn btn-primary w-full"
                >
                  {loading === 'event' ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Create Stage */}
          <div className={`card p-6 ${!createdEvent ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                createdStage ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}>
                {createdStage ? '✓' : '2'}
              </div>
              <h2 className="text-xl font-semibold text-white">Create Stage</h2>
            </div>

            {createdStage ? (
              <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                <p className="text-emerald-300">
                  <strong>Created:</strong> {createdStage.name}
                </p>
                <p className="text-amber-300 text-sm mt-1">
                  <strong>Unlock Code:</strong> <code className="bg-slate-800 px-2 py-0.5 rounded">{createdStage.unlock_code}</code>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Stage Name</label>
                  <input
                    type="text"
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    className="input"
                    placeholder="Stage 1"
                    disabled={!createdEvent}
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Unlock Code</label>
                  <input
                    type="text"
                    value={stageCode}
                    onChange={(e) => setStageCode(e.target.value)}
                    className="input font-mono"
                    placeholder="SECRET123"
                    disabled={!createdEvent}
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Description</label>
                  <textarea
                    value={stageDescription}
                    onChange={(e) => setStageDescription(e.target.value)}
                    className="input"
                    rows={2}
                    placeholder="Instructions for this stage..."
                    disabled={!createdEvent}
                  />
                </div>
                <button
                  onClick={createStage}
                  disabled={loading === 'stage' || !createdEvent || !stageName || !stageCode}
                  className="btn btn-primary w-full"
                >
                  {loading === 'stage' ? 'Creating...' : 'Create Stage'}
                </button>
              </div>
            )}
          </div>

          {/* Step 3: Create Team */}
          <div className={`card p-6 ${!createdEvent ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                createdTeam ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}>
                {createdTeam ? '✓' : '3'}
              </div>
              <h2 className="text-xl font-semibold text-white">Create Team</h2>
            </div>

            {createdTeam ? (
              <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                <p className="text-emerald-300">
                  <strong>Created:</strong> {createdTeam.name}
                </p>
                <p className="text-cyan-300 text-sm mt-2">
                  <strong>Join Code:</strong>{' '}
                  <code className="bg-slate-800 px-3 py-1 rounded text-lg font-bold">
                    {createdTeam.join_code}
                  </code>
                </p>
                <p className="text-slate-400 text-xs mt-2">
                  Share this code with team members to join
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-1">Team Name</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="input"
                    placeholder="Team Alpha"
                    disabled={!createdEvent}
                  />
                </div>
                <button
                  onClick={createTeam}
                  disabled={loading === 'team' || !createdEvent || !teamName}
                  className="btn btn-primary w-full"
                >
                  {loading === 'team' ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {createdEvent && createdStage && createdTeam && (
          <div className="card p-6 mt-6 bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 border-emerald-700/50">
            <h2 className="text-xl font-bold text-white mb-4">🎉 Setup Complete!</h2>
            <div className="space-y-2 text-sm">
              <p className="text-slate-300">
                <strong className="text-emerald-400">Event:</strong> {createdEvent.name}
              </p>
              <p className="text-slate-300">
                <strong className="text-emerald-400">Stage:</strong> {createdStage.name} (Code: {createdStage.unlock_code})
              </p>
              <p className="text-slate-300">
                <strong className="text-emerald-400">Team:</strong> {createdTeam.name} (Join: {createdTeam.join_code})
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700">
              <Link to="/test" className="btn btn-primary">
                View in Test Page →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

