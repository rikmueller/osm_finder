import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  apiClient,
  ConfigResponse,
  GeoJsonResponse,
  JobStatus,
} from './api'
import Header from './components/Header'
import InteractiveMap, { MapPoi, TileSource } from './components/InteractiveMap'
import SettingsSheet from './components/SettingsSheet'
import PresetSelectionModal from './components/PresetSelectionModal'
import FilterSelectionModal from './components/FilterSelectionModal'
import SeoMeta from './components/SeoMeta'
import { useWebSocket } from './hooks/useWebSocket'
import './DevApp.css'

const TILE_SOURCES: TileSource[] = [
  {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    id: 'opentopo',
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
  {
    id: 'cyclosm',
    name: 'CyclOSM',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.cyclosm.org/">CyclOSM</a>',
  },
]

const LOCAL_STORAGE_TILE_KEY = 'whatsaround.tile'
const LOCAL_STORAGE_SETTINGS_KEY = 'whatsaround.settings'
const LOCAL_STORAGE_TRACK_DATA_KEY = 'whatsaround.trackData'
const LOCAL_STORAGE_MARKER_POSITION_KEY = 'whatsaround.markerPosition'
const LOCAL_STORAGE_INPUT_MODE_KEY = 'whatsaround.inputMode'

function loadTilePreference(): string {
  if (typeof window === 'undefined') return TILE_SOURCES[0].id
  return localStorage.getItem(LOCAL_STORAGE_TILE_KEY) || TILE_SOURCES[0].id
}

function saveTilePreference(tileId: string) {
  try {
    localStorage.setItem(LOCAL_STORAGE_TILE_KEY, tileId)
  } catch (err) {
    console.warn('Could not persist tile preference', err)
  }
}

function loadSettings(): Settings | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (err) {
    console.warn('Could not load settings from localStorage', err)
    return null
  }
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings))
  } catch (err) {
    console.warn('Could not persist settings', err)
  }
}

function loadTrackData() {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_TRACK_DATA_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (err) {
    console.warn('Could not load track data from localStorage', err)
    return null
  }
}

function saveTrackData(trackData: [number, number][]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_TRACK_DATA_KEY, JSON.stringify(trackData))
  } catch (err) {
    console.warn('Could not persist track data', err)
  }
}

function loadMarkerPosition(): [number, number] | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_MARKER_POSITION_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (err) {
    console.warn('Could not load marker position from localStorage', err)
    return null
  }
}

function saveMarkerPosition(position: [number, number] | null) {
  try {
    if (position) {
      localStorage.setItem(LOCAL_STORAGE_MARKER_POSITION_KEY, JSON.stringify(position))
    } else {
      localStorage.removeItem(LOCAL_STORAGE_MARKER_POSITION_KEY)
    }
  } catch (err) {
    console.warn('Could not persist marker position', err)
  }
}

function loadInputMode(): 'track' | 'marker' | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_INPUT_MODE_KEY)
    if (saved === 'track' || saved === 'marker') return saved
    return null
  } catch (err) {
    console.warn('Could not load input mode from localStorage', err)
    return null
  }
}

function saveInputMode(mode: 'track' | 'marker') {
  try {
    localStorage.setItem(LOCAL_STORAGE_INPUT_MODE_KEY, mode)
  } catch (err) {
    console.warn('Could not persist input mode', err)
  }
}

function clearPersistedSettings() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_SETTINGS_KEY)
    localStorage.removeItem(LOCAL_STORAGE_TRACK_DATA_KEY)
    localStorage.removeItem(LOCAL_STORAGE_MARKER_POSITION_KEY)
    localStorage.removeItem(LOCAL_STORAGE_INPUT_MODE_KEY)
  } catch (err) {
    console.warn('Could not clear persisted settings', err)
  }
}

/**
 * Parse GPX file using browser's DOMParser to extract track coordinates
 */
async function parseGPXFile(file: File): Promise<[number, number][]> {
  const text = await file.text()
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(text, 'text/xml')
  
  // Check for XML parsing errors
  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    throw new Error('Invalid GPX file - malformed XML')
  }
  
  // Extract all track points from all track segments
  const trkpts = xmlDoc.querySelectorAll('trk trkseg trkpt')
  
  if (trkpts.length === 0) {
    throw new Error('Invalid GPX file - no track points found')
  }
  
  const trackPoints: [number, number][] = []
  trkpts.forEach(pt => {
    const lat = pt.getAttribute('lat')
    const lon = pt.getAttribute('lon')
    if (lat && lon) {
      trackPoints.push([parseFloat(lon), parseFloat(lat)])
    }
  })
  
  if (trackPoints.length === 0) {
    throw new Error('Invalid GPX file - no valid coordinates found')
  }
  
  return trackPoints
}

type FilterModalMode = 'include' | 'exclude'

type Settings = {
  projectName: string
  radiusKm: number
  includes: string[]
  excludes: string[]
  presets: string[]
}

function DevApp() {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [trackData, setTrackData] = useState<[number, number][]>(() => loadTrackData() || [])
  const [poiData, setPoiData] = useState<MapPoi[]>([])
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(() => loadMarkerPosition())
  const [inputMode, setInputMode] = useState<'track' | 'marker'>(() => {
    const savedMode = loadInputMode()
    if (savedMode) return savedMode
    return loadMarkerPosition() ? 'marker' : 'track'
  })
  const [sheetOpen, setSheetOpen] = useState(() => window.innerWidth >= 992)
  const [tileId, setTileId] = useState<string>(loadTilePreference())
  const [pulseFab, setPulseFab] = useState(() => window.innerWidth < 992)

  const [settings, setSettings] = useState<Settings>(() => {
    const saved = loadSettings()
    return saved || {
      projectName: '',
      radiusKm: 5,
      includes: [] as string[],
      excludes: [] as string[],
      presets: [] as string[],
    }
  })

  const [presetModalOpen, setPresetModalOpen] = useState(false)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [filterModalMode, setFilterModalMode] = useState<FilterModalMode>('include')

  const fetchGeoJson = useCallback(
    async (id: string) => {
      try {
        const data: GeoJsonResponse = await apiClient.getGeoJson(id)
        const poiFeatures = data.features.filter(
          (f) => f.geometry.type === 'Point' && f.properties?.featureType === 'poi'
        )
        const pois: MapPoi[] = poiFeatures.map((f, idx) => ({
          id: `${f.properties.id || idx}`,
          name: f.properties.name || 'Unnamed',
          coords: f.geometry.type === 'Point' ? f.geometry.coordinates : [0, 0],
          matchingFilter: f.properties.matching_filter || '',
          kilometersFromStart: f.properties.kilometers_from_start ?? 0,
          distanceKm: f.properties.distance_km ?? 0,
          website: f.properties.website || '',
          phone: f.properties.phone || '',
          openingHours: f.properties.opening_hours || '',
          tags: f.properties.tags || '',
        }))
        setPoiData(pois)
      } catch (err) {
        setError(`Failed to load POI data: ${err}`)
      }
    },
    [],
  )

  const handleJobUpdate = useCallback(
    (job: JobStatus) => {
      setJobStatus(job)
      if (job.state === 'completed') {
        fetchGeoJson(job.id)
      } else if (job.state === 'failed') {
        setError(job.error || 'Processing failed')
      }
    },
    [fetchGeoJson],
  )

  // WebSocket subscription for live progress
  useWebSocket(jobId, handleJobUpdate)

  // Auto-dismiss FAB pulse after 20 seconds (10 cycles × 2s)
  useEffect(() => {
    if (!pulseFab) return
    const timer = setTimeout(() => {
      setPulseFab(false)
    }, 20000)
    return () => clearTimeout(timer)
  }, [pulseFab])

  // Close settings sheet on mobile when processing completes
  useEffect(() => {
    if (jobStatus && jobStatus.state === 'completed' && window.innerWidth < 992) {
      setSheetOpen(false)
    }
  }, [jobStatus])

  // Load config and restore settings from localStorage
  useEffect(() => {
    const load = async () => {
      try {
        const cfg = await apiClient.getConfig()
        setConfig(cfg)
        // Only override settings from config if they weren't already loaded from localStorage
        const savedSettings = loadSettings()
        if (!savedSettings) {
          setSettings((prev: Settings) => ({
            ...prev,
            projectName: cfg.defaults.project_name,
            radiusKm: cfg.defaults.radius_km,
            includes: cfg.defaults.include,
            excludes: cfg.defaults.exclude,
          }))
        }
      } catch (err) {
        setError(`Failed to load config: ${err}`)
      }
    }
    load()
  }, [])

  // Persist tile preference
  useEffect(() => {
    if (tileId) saveTilePreference(tileId)
  }, [tileId])

  // Auto-save settings to localStorage whenever they change (but only after config is loaded)
  useEffect(() => {
    if (!config) return // Don't save until config is loaded
    saveSettings(settings)
  }, [settings, config])

  // Auto-save track data to localStorage whenever it changes
  useEffect(() => {
    if (trackData.length > 0) {
      saveTrackData(trackData)
    } else {
      // Clear track data from localStorage if empty
      try {
        localStorage.removeItem(LOCAL_STORAGE_TRACK_DATA_KEY)
      } catch (err) {
        console.warn('Could not clear track data from localStorage', err)
      }
    }
  }, [trackData])

  // Auto-save marker position to localStorage whenever it changes
  useEffect(() => {
    saveMarkerPosition(markerPosition)
  }, [markerPosition])

  // Auto-save input mode to localStorage whenever it changes
  useEffect(() => {
    saveInputMode(inputMode)
  }, [inputMode])

  const tileSource = useMemo(
    () => TILE_SOURCES.find((t) => t.id === tileId) || TILE_SOURCES[0],
    [tileId]
  )

  const handleFileSelected = async (file: File | null) => {
    setUploadedFile(file)
    if (!file) {
      setTrackData([])
      return
    }
    
    // Parse GPX and display track immediately
    try {
      const trackPoints = await parseGPXFile(file)
      setTrackData(trackPoints)
      setPoiData([]) // Clear POIs from previous run
      setJobStatus(null) // Reset job status
      setJobId(null) // Clear job ID
      setInputMode('track')
      setError(null) // Clear any previous errors
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to parse GPX file - please check file format'
      setError(message)
      setTrackData([])
    }
  }

  const handleSettingsChange = (changes: Partial<typeof settings>) => {
    setSettings((prev: Settings) => ({ ...prev, ...changes }))
  }

  const handleMarkerChange = (position: [number, number] | null) => {
    setMarkerPosition(position)
    if (position) {
      setInputMode('marker')
      setError(null)
    }
  }

  const handleClearMarker = () => {
    setMarkerPosition(null)
    setPoiData([]) // Clear POIs from previous run
    setJobStatus(null) // Reset job status
    setJobId(null) // Clear job ID
  }

  const handleToggleMarkerMode = () => {
    if (inputMode === 'marker') {
      // Disable marker mode - switch to track mode
      setPoiData([]) // Clear POIs from previous run
      setJobStatus(null) // Reset job status
      setJobId(null) // Clear job ID
      setInputMode('track')
      setError(null)
    } else {
      // Enable marker mode - switch to marker mode, marker is set by user click
      // Keep existing track and marker data for quick mode switching
      setPoiData([]) // Clear POIs from previous run
      setJobStatus(null) // Reset job status
      setJobId(null) // Clear job ID
      setInputMode('marker')
      setError(null)
      
      // On mobile, close settings panel so user can see the map and marker
      if (window.innerWidth < 992) {
        setSheetOpen(false)
        setNotification('Please place the marker at the desired position and open the settings again.')
        // Auto-dismiss notification after 5 seconds
        const timer = setTimeout(() => setNotification(null), 5000)
        return () => clearTimeout(timer)
      }
    }
  }

  const handleStart = async () => {
    // Validate input based on mode
    if (inputMode === 'track') {
      if (!uploadedFile) {
        setError('Please upload a GPX file or switch to Map Marker mode')
        return
      }
    } else if (inputMode === 'marker') {
      if (!markerPosition) {
        setError('Please place a marker on the map first')
        return
      }
    }
    
    if ((settings.includes || []).length === 0 && (settings.presets || []).length === 0) {
      setError('Please add at least one include filter or preset')
      return
    }
    if (!settings.projectName.trim()) {
      setError('Please provide a project name')
      return
    }

    try {
      setError(null)
      setJobStatus(null) // Reset job status when starting new processing
      setPoiData([]) // Clear only POIs, keep track visible

      const fileToSend = inputMode === 'track' ? uploadedFile : null
      const markerToSend = inputMode === 'marker' ? markerPosition : null
      const result = await apiClient.startProcessing(
        fileToSend,
        settings.projectName,
        settings.radiusKm,
        settings.includes,
        settings.excludes,
        settings.presets,
        markerToSend,
      )

      setJobId(result.job_id)
      // Fetch initial status once in case socket is delayed
      const initialStatus = await apiClient.getJobStatus(result.job_id)
      setJobStatus(initialStatus)
      if (initialStatus.state === 'completed') {
        fetchGeoJson(result.job_id)
      } else if (initialStatus.state === 'failed') {
        setError(initialStatus.error || 'Processing failed')
      }
    } catch (err) {
      setError(`Failed to start processing: ${err}`)
    }
  }

  const handleReset = () => {
    // Clear localStorage persistence
    clearPersistedSettings()
    
    setJobId(null)
    setJobStatus(null)
    setTrackData([])
    setPoiData([])
    setUploadedFile(null)
    setMarkerPosition(null)
    setInputMode('track')
    setError(null)
    setSheetOpen(true)
    setSettings({
      projectName: config?.defaults.project_name || '',
      radiusKm: config?.defaults.radius_km || 5,
      includes: config?.defaults.include || [],
      excludes: config?.defaults.exclude || [],
      presets: [],
    })
  }

  const openPresetModal = () => setPresetModalOpen(true)
  const closePresetModal = () => setPresetModalOpen(false)
  const openFilterModal = (mode: FilterModalMode) => {
    setFilterModalMode(mode)
    setFilterModalOpen(true)
  }
  const closeFilterModal = () => setFilterModalOpen(false)

  const presetsDetail = config?.presets_detail || {}

  const addPresetFilters = (selectedPresets: string[]) => {
    const presetIncludesAll = Object.values(presetsDetail).flatMap((p) => p?.include || [])
    const presetExcludesAll = Object.values(presetsDetail).flatMap((p) => p?.exclude || [])

    const manualIncludes = settings.includes.filter((f) => !presetIncludesAll.includes(f))
    const manualExcludes = settings.excludes.filter((f) => !presetExcludesAll.includes(f))

    const includesFromPresets = selectedPresets.flatMap(
      (p) => presetsDetail[p]?.include || [],
    )
    const excludesFromPresets = selectedPresets.flatMap(
      (p: string) => presetsDetail[p]?.exclude || [],
    )
    setSettings((prev: Settings) => ({
      ...prev,
      presets: selectedPresets,
      includes: Array.from(new Set([...manualIncludes, ...includesFromPresets])),
      excludes: Array.from(new Set([...manualExcludes, ...excludesFromPresets])),
    }))
    // Clear error when presets are added
    if (selectedPresets.length > 0 || manualIncludes.length > 0) {
      setError(null)
    }
  }

  const deletePresetFromChip = (preset: string) => {
    const remainingPresets = settings.presets.filter((p) => p !== preset)
    addPresetFilters(remainingPresets)
  }

  const deleteIncludeFilterFromChip = (filter: string) => {
    // Find which presets contain this filter
    const presetsToRemove = settings.presets.filter((p) => {
      const presetFilters = presetsDetail[p]?.include || []
      return presetFilters.includes(filter)
    })

    if (presetsToRemove.length > 0) {
      // Get all filters from these presets EXCEPT the one being deleted
      const filtersFromRemovedPresets = presetsToRemove.flatMap(
        (p) => presetsDetail[p]?.include || []
      ).filter((f) => f !== filter)

      // Remove the presets but keep their other filters as manual filters
      const remainingPresets = settings.presets.filter((p) => !presetsToRemove.includes(p))
      
      // Get current manual filters (not from any preset)
      const allPresetIncludeFilters = Object.values(presetsDetail).flatMap((p) => p?.include || [])
      const allPresetExcludeFilters = Object.values(presetsDetail).flatMap((p) => p?.exclude || [])
      const currentManualIncludes = settings.includes.filter((f) => !allPresetIncludeFilters.includes(f))
      const currentManualExcludes = settings.excludes.filter((f) => !allPresetExcludeFilters.includes(f))
      
      // Recalculate with remaining presets, keeping other filters from removed preset as manual
      const includesFromRemainingPresets = remainingPresets.flatMap(
        (p) => presetsDetail[p]?.include || [],
      )
      const excludesFromRemainingPresets = remainingPresets.flatMap(
        (p) => presetsDetail[p]?.exclude || [],
      )
      
      setSettings((prev: Settings) => ({
        ...prev,
        presets: remainingPresets,
        includes: Array.from(new Set([...currentManualIncludes, ...filtersFromRemovedPresets, ...includesFromRemainingPresets])),
        excludes: Array.from(new Set([...currentManualExcludes, ...excludesFromRemainingPresets])),
      }))
    } else {
      // Filter was manually added, just remove it
      setSettings((prev: Settings) => ({
        ...prev,
        includes: prev.includes.filter((f: string) => f !== filter),
      }))
    }
  }

  const deleteExcludeFilterFromChip = (filter: string) => {
    // Find which presets contain this filter
    const presetsToRemove = settings.presets.filter((p) => {
      const presetFilters = presetsDetail[p]?.exclude || []
      return presetFilters.includes(filter)
    })

    if (presetsToRemove.length > 0) {
      // Get all filters from these presets EXCEPT the one being deleted
      const filtersFromRemovedPresets = presetsToRemove.flatMap(
        (p) => presetsDetail[p]?.exclude || []
      ).filter((f) => f !== filter)

      // Remove the presets but keep their other filters as manual filters
      const remainingPresets = settings.presets.filter((p) => !presetsToRemove.includes(p))
      
      // Get current manual filters (not from any preset)
      const allPresetFilters = Object.values(presetsDetail).flatMap((p) => p?.exclude || [])
      const currentManualFilters = settings.excludes.filter((f) => !allPresetFilters.includes(f))
      
      // Recalculate with remaining presets, keeping other filters from removed preset as manual
      const includesFromRemainingPresets = remainingPresets.flatMap(
        (p) => presetsDetail[p]?.include || [],
      )
      const excludesFromRemainingPresets = remainingPresets.flatMap(
        (p: string) => presetsDetail[p]?.exclude || [],
      )
      
      setSettings((prev: Settings) => ({
        ...prev,
        presets: remainingPresets,
        includes: Array.from(new Set([...prev.includes.filter((f: string) => !allPresetFilters.includes(f)), ...includesFromRemainingPresets])),
        excludes: Array.from(new Set([...currentManualFilters, ...filtersFromRemovedPresets, ...excludesFromRemainingPresets])),
      }))
    } else {
      // Filter was manually added, just remove it
      setSettings((prev: Settings) => ({
        ...prev,
        excludes: prev.excludes.filter((f: string) => f !== filter),
      }))
    }
  }

  return (
    <div className={`dev-app ${sheetOpen ? 'sheet-open' : 'sheet-closed'}`}>
      <SeoMeta
        title="App | WhatsAround"
        description="Run POI searches with custom filters, view results on a live map, and export Excel or HTML maps."
        url="https://getwhatsaround.app/app"
      />
      <Header logoHref="/app" />
      {notification && (
        <div style={{
          position: 'fixed',
          top: '65%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          color: '#1f2937',
          padding: '0',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 170,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          maxWidth: '90vw',
          textAlign: 'center',
        }}>
          {notification}
        </div>
      )}
      <InteractiveMap
        track={inputMode === 'track' ? trackData : []}
        pois={poiData}
        markerPosition={inputMode === 'marker' ? markerPosition : null}
        onMarkerChange={handleMarkerChange}
        inputMode={inputMode}
        tileSource={tileSource}
        tileOptions={TILE_SOURCES}
        onTileChange={setTileId}
        jobStatus={jobStatus}
      />

      <SettingsSheet
        open={sheetOpen}
        onToggle={() => setSheetOpen((prev) => !prev)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onFileSelected={handleFileSelected}
        selectedFile={uploadedFile}
        inputMode={inputMode}
        markerPosition={markerPosition}
        onClearMarker={handleClearMarker}
        onToggleMarkerMode={handleToggleMarkerMode}
        onStart={handleStart}
        status={jobStatus}
        error={error}
        onReset={handleReset}
        onOpenPresetModal={openPresetModal}
        onOpenIncludeModal={() => openFilterModal('include')}
        onOpenExcludeModal={() => openFilterModal('exclude')}
        onDeletePreset={deletePresetFromChip}
        onDeleteIncludeFilter={deleteIncludeFilterFromChip}
        onDeleteExcludeFilter={deleteExcludeFilterFromChip}
        shouldPulseFab={pulseFab}
        onFabClick={() => setPulseFab(false)}
      />

      <PresetSelectionModal
        open={presetModalOpen}
        selected={settings.presets}
        presetsDetail={presetsDetail}
        onClose={closePresetModal}
        onSave={(newPresets) => {
          addPresetFilters(newPresets)
          closePresetModal()
        }}
      />

      <FilterSelectionModal
        open={filterModalOpen}
        mode={filterModalMode}
        existing={filterModalMode === 'include' ? settings.includes : settings.excludes}
        onClose={closeFilterModal}
        onSave={(filters: string[]) => {
          setSettings((prev: Settings) => ({
            ...prev,
            [filterModalMode === 'include' ? 'includes' : 'excludes']: filters,
          }))
          // Clear error only if we have includes or presets (not just excludes)
          const newIncludes = filterModalMode === 'include' ? filters : settings.includes
          if (newIncludes.length > 0 || settings.presets.length > 0) {
            setError(null)
          }
          closeFilterModal()
        }}
      />
    </div>
  )
}

export default DevApp
