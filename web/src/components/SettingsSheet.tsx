import { ChangeEvent, useEffect, useRef } from 'react'
import { Sheet, MapPin } from 'lucide-react'
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
  onStart: () => void
  status: JobStatus | null
  error: string | null
  onReset: () => void
  onOpenPresetModal: () => void
  onOpenIncludeModal: () => void
  onOpenExcludeModal: () => void
  onDeletePreset: (preset: string) => void
}

export default function SettingsSheet({
  open,
  onToggle,
  settings,
  onSettingsChange,
  onFileSelected,
  selectedFile,
  onStart,
  status,
  error,
  onReset,
  onOpenPresetModal,
  onOpenIncludeModal,
  onOpenExcludeModal,
  onDeletePreset,
}: Props) {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    onFileSelected(file || null)
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  const deleteIncludeFilter = (filter: string) => {
    onSettingsChange({ includes: settings.includes.filter((f) => f !== filter) })
  }

  const deleteExcludeFilter = (filter: string) => {
    onSettingsChange({ excludes: settings.excludes.filter((f) => f !== filter) })
  }

  const deletePreset = (preset: string) => {
    onDeletePreset(preset)
  }

  return (
    <>
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
        <div className="sheet-grabber" onClick={onToggle} aria-label="Toggle controls">
          <div className="grab-handle" />
        </div>

        <div className="sheet-content">
        {status?.state === 'processing' ? (
          <div className="alert alert-warning">
            <strong>Processing:</strong> {status?.message || 'Working...'} — {status?.percent ?? 0}%
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : null}

        <section className="sheet-section">
          <div className="section-head">
            <h3>GPX-Track</h3>
            {selectedFile && <span className="chip">{selectedFile.name}</span>}
          </div>
          <label className="upload-tile">
            <input ref={fileInputRef} type="file" accept=".gpx" onChange={handleFileChange} />
            <div className="upload-body">
              <div className="upload-icon">^</div>
              <div>
                <div className="upload-title">Drop or click to upload</div>
                <div className="muted">GPX only, max 50MB</div>
              </div>
            </div>
          </label>
        </section>

        <section className="sheet-section">
          <div className="section-head">
            <h3>General</h3>
          </div>
          <div className="field field-inline">
            <label htmlFor="projectName">Project name</label>
            <input
              id="projectName"
              value={settings.projectName}
              onChange={(e) => onSettingsChange({ projectName: e.target.value })}
              placeholder="My adventure"
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
              />
              <span className="slider-value">{settings.radiusKm} km</span>
            </div>
          </div>
          
        </section>

        <section className="sheet-section">
          <div className="section-head">
            <h3>Presets</h3>
            <button className="add-btn" onClick={onOpenPresetModal} title="Add presets">
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
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="sheet-section">
          <div className="section-head">
            <h3>Include filters</h3>
            <button className="add-btn" onClick={onOpenIncludeModal} title="Add include filters">
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
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="sheet-section">
          <div className="section-head">
            <h3>Exclude filters</h3>
            <button className="add-btn" onClick={onOpenExcludeModal} title="Add exclude filters">
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
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="sheet-section">
          <div className="section-head">
            <h3>Downloads</h3>
            {status?.excel_file || status?.html_file ? (
              <div className="download-icons">
                {status?.excel_file && (
                  <a
                    href={`/api/download/excel/${status.excel_file}`}
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
                    href={`/api/download/html/${status.html_file}`}
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

        <div className="actions">
          <div className="action-buttons">
            <button className="btn btn-secondary" onClick={onReset}>
              Reset
            </button>
            <button className="btn btn-primary" onClick={onStart}>
              {status?.state === 'processing' ? 'Processing...' : 'Process'}
            </button>
          </div>
        </div>
      </div>
    </aside>
    </>
  )
}
