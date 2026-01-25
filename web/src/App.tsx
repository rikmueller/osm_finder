import { useState, useEffect } from 'react'
import { apiClient, ConfigResponse, JobStatus } from './api'
import UploadArea from './components/UploadArea'
import SettingsForm from './components/SettingsForm'
import ProgressCard from './components/ProgressCard'
import ResultsPanel from './components/ResultsPanel'
import './App.css'

type Stage = 'idle' | 'uploading' | 'processing' | 'completed' | 'error'

interface ProcessingState {
  stage: Stage
  jobId: string | null
  status: JobStatus | null
  config: ConfigResponse | null
  error: string | null
}

function App() {
  const [state, setState] = useState<ProcessingState>({
    stage: 'idle',
    jobId: null,
    status: null,
    config: null,
    error: null,
  })

  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [settings, setSettings] = useState({
    projectName: '',
    radiusKm: 5,
    includes: [] as string[],
    excludes: [] as string[],
    presets: [] as string[],
  })

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await apiClient.getConfig()
        setState((prev) => ({
          ...prev,
          config,
        }))
        setSettings((prev) => ({
          ...prev,
          projectName: config.defaults.project_name,
          radiusKm: config.defaults.radius_km,
          includes: config.defaults.include,
          excludes: config.defaults.exclude,
        }))
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: `Failed to load configuration: ${err}`,
        }))
      }
    }
    loadConfig()
  }, [])

  // Poll job status when processing
  useEffect(() => {
    if (state.stage !== 'processing' || !state.jobId) return

    const pollInterval = setInterval(async () => {
      try {
        const status = await apiClient.getJobStatus(state.jobId!)
        setState((prev) => ({
          ...prev,
          status,
          stage: status.state === 'completed' ? 'completed' : status.state === 'failed' ? 'error' : 'processing',
          error: status.error || null,
        }))
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: `Failed to fetch job status: ${err}`,
        }))
      }
    }, 1000)

    return () => clearInterval(pollInterval)
  }, [state.stage, state.jobId])

  const handleFileSelected = (file: File) => {
    setUploadedFile(file)
  }

  const handleSettingsChange = (newSettings: typeof settings) => {
    setSettings(newSettings)
  }

  const handleProcessStart = async () => {
    if (!uploadedFile) {
      setState((prev) => ({
        ...prev,
        error: 'Please upload a GPX file',
      }))
      return
    }

    if ((settings.includes || []).length === 0) {
      setState((prev) => ({
        ...prev,
        error: 'Please add at least one include filter (select a preset or add a custom include).',
      }))
      return
    }

    if (!settings.projectName || settings.projectName.trim() === '') {
      setState((prev) => ({
        ...prev,
        error: 'Please provide a project name before generating.',
      }))
      return
    }

    try {
      setState((prev) => ({
        ...prev,
        stage: 'uploading',
        error: null,
      }))

      const result = await apiClient.startProcessing(
        uploadedFile,
        settings.projectName,
        settings.radiusKm,
        settings.includes,
        settings.excludes
      )

      setState((prev) => ({
        ...prev,
        stage: 'processing',
        jobId: result.job_id,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        stage: 'error',
        error: `Failed to start processing: ${err}`,
      }))
    }
  }

  const handleReset = () => {
    setState({
      stage: 'idle',
      jobId: null,
      status: null,
      config: state.config,
      error: null,
    })
    setUploadedFile(null)
    setSettings({
      projectName: state.config?.defaults.project_name || '',
      radiusKm: state.config?.defaults.radius_km || 5,
      includes: state.config?.defaults.include || [],
      excludes: state.config?.defaults.exclude || [],
      presets: [],
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <h1>🗺️ AlongGPX</h1>
          <p>Find OpenStreetMap POIs along GPX tracks</p>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          {state.error && (
            <div className="error-banner">
              <strong>Error:</strong> {state.error}
            </div>
          )}

          {state.stage === 'idle' && (
            <div className="two-column">
              <div className="column">
                <UploadArea onFileSelected={handleFileSelected} selectedFile={uploadedFile} />
              </div>
              <div className="column">
                {state.config && (
                  <SettingsForm
                    config={state.config}
                    settings={settings}
                    onChange={handleSettingsChange}
                    onStart={handleProcessStart}
                    isProcessing={false}
                  />
                )}
              </div>
            </div>
          )}

          {(state.stage === 'uploading' || state.stage === 'processing') && state.status && (
            <div className="processing-view">
              <ProgressCard status={state.status} />
            </div>
          )}

          {state.stage === 'completed' && state.status && (
            <div className="results-view">
              <ResultsPanel status={state.status} onReset={handleReset} />
            </div>
          )}

          {state.stage === 'error' && (
            <div className="error-view">
              <div className="error-card">
                <h2>Processing Failed</h2>
                <p>{state.status?.error || state.error}</p>
                <button onClick={handleReset} className="btn btn-primary">
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <div className="container">
          <p>
            AlongGPX © 2026 • Powered by{' '}
            <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
