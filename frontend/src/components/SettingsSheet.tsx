import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Sheet, MapPin, X, Settings } from 'lucide-react'
import { JobStatus } from '../api'
import './SettingsSheet.css'

type Props = {
  open: boolean
  onToggle: () => void
  settings: {
    projectName: string
    radiusKm: number
    includes: string[]
    excludes: string[]
    presets: string[]
  }
  onSettingsChange: (changes: Partial<Props['settings']>) => void
  onFileSelected: (file: File | null) => void
  selectedFile: File | null
  trackLabel?: string | null
  inputMode: 'track' | 'marker'
  markerPosition: [number, number] | null
  onClearMarker: () => void
  onToggleMarkerMode: () => void
  onStart: () => void
  status: JobStatus | null
  error: string | null
  onReset: () => void
  onOpenPresetModal: () => void
  onOpenIncludeModal: () => void
  onOpenExcludeModal: () => void
  onDeletePreset: (preset: string) => void
  onDeleteIncludeFilter: (filter: string) => void
  onDeleteExcludeFilter: (filter: string) => void
  shouldPulseFab?: boolean
  onFabClick?: () => void
  isSearchDisabled?: boolean
  isSearchRunning?: boolean
}

export default function SettingsSheet({
  open,
  onToggle,
  settings,
  onSettingsChange,
  onFileSelected,
  selectedFile,
  trackLabel,
  inputMode,
  markerPosition,
  onClearMarker,
  onToggleMarkerMode,
  onStart,
  status,
  error,
  onReset,
  onOpenPresetModal,
  onOpenIncludeModal,
  onOpenExcludeModal,
  onDeletePreset,
  onDeleteIncludeFilter,
  onDeleteExcludeFilter,
  shouldPulseFab = false,
  onFabClick,
  isSearchDisabled = false,
  isSearchRunning = false,
}: Props) {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    onFileSelected(file || null)
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.gpx')) {
      onFileSelected(file)
    }
  }

  // Clear native file input when selectedFile is reset to null
  useEffect(() => {
    if (!selectedFile && fileInputRef.current) {
      try {
        fileInputRef.current.value = ''
      } catch (e) {
        // ignore
      }
    }
  }, [selectedFile])

  // Scroll to error message when it appears
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [error])

  const deleteIncludeFilter = (filter: string) => {
    onDeleteIncludeFilter(filter)
  }

  const deleteExcludeFilter = (filter: string) => {
    onDeleteExcludeFilter(filter)
  }

  const deletePreset = (preset: string) => {
    onDeletePreset(preset)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onToggle()
    }
  }

  return (
    <>
      {/* Mobile FAB - only visible on mobile when closed */}
      {!open && (
        <button
          className={`sheet-fab-mobile ${shouldPulseFab ? 'needs-attention' : ''}`}
          onClick={() => {
            onToggle()
            onFabClick?.()
          }}
          aria-label="Open settings"
          title="Open settings"
        >
          <Settings size={24} />
        </button>
      )}

      {/* Mobile backdrop */}
      {open && <div className="sheet-backdrop-mobile" onClick={handleBackdropClick} />}

      {/* Desktop toggle button */}
      {!open && (
        <button
          className="sheet-toggle"
          onClick={onToggle}
          aria-label={open ? 'Collapse controls' : 'Expand controls'}
          title={open ? 'Collapse controls' : 'Expand controls'}
        >
          {open ? '›' : '‹'}
        </button>
      )}

      <aside className={`sheet ${open ? 'open' : 'closed'}`}>
        {/* Desktop collapse button */}
        {open && (
          <button
            className="sheet-collapse-btn in-panel"
            onClick={onToggle}
            aria-label="Collapse controls"
            title="Collapse controls"
          >
            ›
          </button>
        )}

        {/* Mobile header bar with buttons and close */}
        <div className="sheet-mobile-header">
          <h2 className="sheet-mobile-title">Settings</h2>
          <div className="sheet-header-actions">
            <button className="btn btn-secondary btn-compact" onClick={onReset}>
              Reset
            </button>
            <button 
              className="btn btn-primary btn-compact" 
              onClick={onStart}
              disabled={status?.state === 'processing' || isSearchDisabled}
            >
              {status?.state === 'processing' ? 'Searching...' : 'Search'}
            </button>
            <button
              className="sheet-mobile-close"
              onClick={onToggle}
              aria-label="Close settings"
              title="Close settings"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Desktop header bar with buttons */}
        <div className="sheet-desktop-header">
          <h2 className="sheet-desktop-title">Settings</h2>
          <div className="sheet-header-actions">
            <button className="btn btn-secondary btn-compact" onClick={onReset}>
              Reset
            </button>
            <button 
              className="btn btn-primary btn-compact" 
              onClick={onStart}
              disabled={status?.state === 'processing' || isSearchDisabled}
            >
              {status?.state === 'processing' ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Mobile grabber - hidden but kept for desktop */}
        <div className="sheet-grabber" onClick={onToggle} aria-label="Toggle controls">
          <div className="grab-handle" />
        </div>

        <div className="sheet-content">
        {status?.state === 'processing' ? (
          <div className="alert alert-warning">
            <strong>Processing:</strong> {status?.message || 'Working...'} — {status?.percent ?? 0}%
          </div>
        ) : error ? (
          <div className="alert alert-error" ref={errorRef}>{error}</div>
        ) : null}

        <section className="sheet-section" style={{ opacity: isSearchRunning ? 0.5 : 1, pointerEvents: isSearchRunning ? 'none' : 'auto' }}>
          <div className="section-head">
            <h3>Project Settings</h3>
          </div>
          <div className="field field-inline">
            <label htmlFor="projectName">Project name</label>
            <input
              id="projectName"
              value={settings.projectName}
              onChange={(e) => onSettingsChange({ projectName: e.target.value })}
              placeholder="My adventure"
              disabled={isSearchRunning}
            />
          </div>
          <div className="field field-inline">
            <label htmlFor="radius">Search radius</label>
            <div className="slider-row">
              <input
                id="radius"
                type="range"
                min={1}
                max={50}
                step={1}
                value={settings.radiusKm}
                onChange={(e) => onSettingsChange({ radiusKm: Number(e.target.value) })}
                disabled={isSearchRunning}
              />
              <span className="slider-value">{settings.radiusKm} km</span>
            </div>
          </div>
          <div className="field field-inline">
            <label>Input mode</label>
            <div className="segmented-control">
              <button
                className={`segmented-option ${inputMode === 'track' ? 'active' : ''}`}
                disabled={isSearchRunning}
                onClick={() => {
                  if (inputMode !== 'track') {
                    onToggleMarkerMode()
                  }
                }}
              >
                GPX Track
              </button>
              <button
                className={`segmented-option ${inputMode === 'marker' ? 'active' : ''}`}
                disabled={isSearchRunning}
                onClick={() => {
                  if (inputMode !== 'marker') {
                    onToggleMarkerMode()
                  }
                }}
              >
                Map Marker
              </button>
            </div>
          </div>
        </section>

        {inputMode === 'track' && (
        <section className="sheet-section" style={{ opacity: isSearchRunning ? 0.5 : 1, pointerEvents: isSearchRunning ? 'none' : 'auto' }}>
          <div className="section-head">
            <h3>GPX Track</h3>
            {selectedFile || trackLabel ? (
              <span className="chip">
                {selectedFile?.name || trackLabel}
                <button
                  className="chip-delete"
                  onClick={() => onFileSelected(null)}
                  aria-label={`Remove ${selectedFile?.name || trackLabel}`}
                  title="Remove track"
                  disabled={isSearchRunning}
                >
                  ×
                </button>
              </span>
            ) : (
              <span className="muted">No track uploaded</span>
            )}
          </div>
          <label 
            className={`upload-tile ${dragOver ? 'dragover' : ''} ${isSearchRunning ? 'disabled' : ''}`}
            onDragOver={isSearchRunning ? undefined : handleDragOver}
            onDragLeave={isSearchRunning ? undefined : handleDragLeave}
            onDrop={isSearchRunning ? undefined : handleDrop}
          >
            <input 
              ref={fileInputRef} 
              type="file" 
              accept=".gpx" 
              onChange={handleFileChange}
              disabled={isSearchRunning}
            />
            <div className="upload-body">
              <div className="upload-icon">^</div>
              <div>
                <div className="upload-title">Drop or click to upload</div>
                <div className="muted">GPX only, max 5MB</div>
              </div>
            </div>
          </label>
        </section>
        )}

        {inputMode === 'marker' && (
        <section className="sheet-section" style={{ opacity: isSearchRunning ? 0.5 : 1, pointerEvents: isSearchRunning ? 'none' : 'auto' }}>
          <div className="section-head">
            <h3>Map Marker</h3>
            {markerPosition ? (
              <span className="chip">
                {markerPosition[0].toFixed(4)}°N, {markerPosition[1].toFixed(4)}°E
                <button
                  className="chip-delete"
                  onClick={onClearMarker}
                  aria-label="Clear marker"
                  title="Clear marker"
                  disabled={isSearchRunning}
                >
                  ×
                </button>
              </span>
            ) : (
              <span className="muted">No marker placed</span>
            )}
          </div>
          <div className="instruction-tile">
            <p>
              {markerPosition 
                ? status 
                  ? 'Marking is locked, clear coordinates to reset.'
                  : window.innerWidth < 992 
                    ? 'Marker is set, delete coordinates to change it'
                    : 'Marker is set, click on the map to change it'
                : <>Click the map to place a marker. <button className="link-button" onClick={onToggle} title="Close settings to access map">Open map</button></>}
            </p>
          </div>
        </section>
        )}

        <section className="sheet-section" style={{ opacity: isSearchRunning ? 0.5 : 1, pointerEvents: isSearchRunning ? 'none' : 'auto' }}>
          <div className="section-head">
            <h3>Presets</h3>
            <button className="add-btn" onClick={onOpenPresetModal} title="Add presets" disabled={isSearchRunning}>
              +
            </button>
            {settings.presets.length === 0 && <span className="muted">No presets selected</span>}
          </div>
          <div className="chips">
            {settings.presets.map((p) => (
              <span key={p} className="chip">
                {p}
                <button
                  className="chip-delete"
                  onClick={() => deletePreset(p)}
                  aria-label={`Delete preset ${p}`}
                  title="Remove preset"
                  disabled={isSearchRunning}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="sheet-section" style={{ opacity: isSearchRunning ? 0.5 : 1, pointerEvents: isSearchRunning ? 'none' : 'auto' }}>
          <div className="section-head">
            <h3>Include filters</h3>
            <button className="add-btn" onClick={onOpenIncludeModal} title="Add include filters" disabled={isSearchRunning}>
              +
            </button>
            {settings.includes.length === 0 && <span className="muted">No include filters</span>}
          </div>
          <div className="chips">
            {settings.includes.map((f) => (
              <span key={f} className="chip">
                {f}
                <button
                  className="chip-delete"
                  onClick={() => deleteIncludeFilter(f)}
                  aria-label={`Delete ${f}`}
                  title="Remove filter"
                  disabled={isSearchRunning}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="sheet-section" style={{ opacity: isSearchRunning ? 0.5 : 1, pointerEvents: isSearchRunning ? 'none' : 'auto' }}>
          <div className="section-head">
            <h3>Exclude filters</h3>
            <button className="add-btn" onClick={onOpenExcludeModal} title="Add exclude filters" disabled={isSearchRunning}>
              +
            </button>
            {settings.excludes.length === 0 && <span className="muted">No exclude filters</span>}
          </div>
          <div className="chips">
            {settings.excludes.map((f) => (
              <span key={f} className="chip">
                {f}
                <button
                  className="chip-delete"
                  onClick={() => deleteExcludeFilter(f)}
                  aria-label={`Delete ${f}`}
                  title="Remove filter"
                  disabled={isSearchRunning}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="sheet-section" style={{ opacity: isSearchRunning ? 0.5 : 1, pointerEvents: isSearchRunning ? 'none' : 'auto' }}>
          <div className="section-head">
            <h3>Downloads</h3>
            {status?.excel_file || status?.html_file ? (
              <div className="download-icons">
                {status?.excel_file && (
                  <a
                    href={`/api/download/excel/${status.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="download-icon"
                    title="Download Excel"
                  >
                    <Sheet size={24} strokeWidth={1.5} />
                  </a>
                )}
                {status?.html_file && (
                  <a
                    href={`/api/download/html/${status.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="download-icon"
                    title="Download Map"
                  >
                    <MapPin size={24} strokeWidth={1.5} />
                  </a>
                )}
              </div>
            ) : (
              <span className="muted">Available after processing</span>
            )}
          </div>
        </section>
      </div>
    </aside>
    </>
  )
}
