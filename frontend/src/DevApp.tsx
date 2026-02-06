import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import Modal from './components/Modal'
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
const LOCAL_STORAGE_TRACK_RESULTS_KEY = 'whatsaround.trackResults'
const LOCAL_STORAGE_MARKER_RESULTS_KEY = 'whatsaround.markerResults'

type SavedResults = {
  poiData: MapPoi[]
  jobStatus: JobStatus | null
  jobId: string | null
}

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

function loadResultsForMode(mode: 'track' | 'marker'): SavedResults | null {
  if (typeof window === 'undefined') return null
  try {
    const key = mode === 'track' ? LOCAL_STORAGE_TRACK_RESULTS_KEY : LOCAL_STORAGE_MARKER_RESULTS_KEY
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : null
  } catch (err) {
    console.warn(`Could not load ${mode} results from localStorage`, err)
    return null
  }
}

function saveResultsForMode(mode: 'track' | 'marker', results: SavedResults) {
  try {
    const key = mode === 'track' ? LOCAL_STORAGE_TRACK_RESULTS_KEY : LOCAL_STORAGE_MARKER_RESULTS_KEY
    localStorage.setItem(key, JSON.stringify(results))
  } catch (err) {
    console.warn(`Could not persist ${mode} results`, err)
  }
}

function clearResultsForMode(mode: 'track' | 'marker') {
  try {
    const key = mode === 'track' ? LOCAL_STORAGE_TRACK_RESULTS_KEY : LOCAL_STORAGE_MARKER_RESULTS_KEY
    localStorage.removeItem(key)
  } catch (err) {
    console.warn(`Could not clear ${mode} results from localStorage`, err)
  }
}

function clearPersistedSettings() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_SETTINGS_KEY)
    localStorage.removeItem(LOCAL_STORAGE_TRACK_DATA_KEY)
    localStorage.removeItem(LOCAL_STORAGE_MARKER_POSITION_KEY)
    localStorage.removeItem(LOCAL_STORAGE_INPUT_MODE_KEY)
    localStorage.removeItem(LOCAL_STORAGE_TRACK_RESULTS_KEY)
    localStorage.removeItem(LOCAL_STORAGE_MARKER_RESULTS_KEY)
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
  
  // Initialize input mode first (needed for loading correct results)
  const [inputMode, setInputMode] = useState<'track' | 'marker'>(() => {
    const savedMode = loadInputMode()
    if (savedMode) return savedMode
    return loadMarkerPosition() ? 'marker' : 'track'
  })
  
  // Load saved results for initial input mode (read mode from localStorage directly to avoid stale closure)
  const [jobId, setJobId] = useState<string | null>(() => {
    const mode = loadInputMode() || (loadMarkerPosition() ? 'marker' : 'track')
    const results = loadResultsForMode(mode)
    return results?.jobId || null
  })
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(() => {
    const mode = loadInputMode() || (loadMarkerPosition() ? 'marker' : 'track')
    const results = loadResultsForMode(mode)
    return results?.jobStatus || null
  })
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [trackData, setTrackData] = useState<[number, number][]>(() => loadTrackData() || [])
  const [poiData, setPoiData] = useState<MapPoi[]>(() => {
    const mode = loadInputMode() || (loadMarkerPosition() ? 'marker' : 'track')
    const results = loadResultsForMode(mode)
    return results?.poiData || []
  })
  const [lastProcessedSettings, setLastProcessedSettings] = useState<(Settings & { inputMode: 'track' | 'marker', fileName?: string, markerLat?: number, markerLon?: number }) | null>(null)
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(() => loadMarkerPosition())
  const [sheetOpen, setSheetOpen] = useState(() => window.innerWidth >= 992)
  const [tileId, setTileId] = useState<string>(loadTilePreference())
  const [pulseFab, setPulseFab] = useState(() => window.innerWidth < 992)
  const previousJobState = useRef<JobStatus['state'] | null>(null)

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
  const [confirmSearchModalOpen, setConfirmSearchModalOpen] = useState(false)
  const [confirmResetModalOpen, setConfirmResetModalOpen] = useState(false)

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
        // Save settings snapshot when job completes successfully
        setLastProcessedSettings({
          ...settings,
          inputMode,
          fileName: uploadedFile?.name,
          markerLat: markerPosition?.[0],
          markerLon: markerPosition?.[1],
        })
      } else if (job.state === 'failed') {
        setError(job.error || 'Processing failed')
      }
    },
    [fetchGeoJson, settings, inputMode, uploadedFile, markerPosition],
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
    const prevState = previousJobState.current
    const justCompleted =
      (prevState === 'queued' || prevState === 'processing') &&
      jobStatus?.state === 'completed'

    if (justCompleted && window.innerWidth < 992) {
      setSheetOpen(false)
    }
    previousJobState.current = jobStatus?.state ?? null
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
        
        // Restore lastProcessedSettings if results were loaded (happens in state initialization)
        if (jobStatus?.state === 'completed') {
          setLastProcessedSettings({
            ...settings,
            inputMode,
            fileName: uploadedFile?.name,
            markerLat: markerPosition?.[0],
            markerLon: markerPosition?.[1],
          })
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

  // Auto-save results to localStorage when job completes
  useEffect(() => {
    if (jobStatus?.state === 'completed' && poiData.length > 0) {
      saveResultsForMode(inputMode, { poiData, jobStatus, jobId })
    } else if (jobStatus?.state === 'failed') {
      // Clear saved results on error
      clearResultsForMode(inputMode)
    }
  }, [jobStatus, poiData, jobId, inputMode])

  const tileSource = useMemo(
    () => TILE_SOURCES.find((t) => t.id === tileId) || TILE_SOURCES[0],
    [tileId]
  )

  const handleFileSelected = async (file: File | null) => {
    setUploadedFile(file)
    setLastProcessedSettings(null) // Clear snapshot when file changes
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
      clearResultsForMode('track') // Clear saved track results
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
    setLastProcessedSettings(null) // Clear snapshot when settings change
  }

  const handleMarkerChange = (position: [number, number] | null) => {
    setMarkerPosition(position)
    setLastProcessedSettings(null) // Clear snapshot when marker changes
    if (position) {
      // Clear marker results when marker position changes
      setPoiData([]) // Clear POIs from previous run
      setJobStatus(null) // Reset job status
      setJobId(null) // Clear job ID
      clearResultsForMode('marker') // Clear saved marker results
      setInputMode('marker')
      setError(null)
    }
  }

  const handleClearMarker = () => {
    setMarkerPosition(null)
    setLastProcessedSettings(null) // Clear snapshot when marker is cleared
    setPoiData([]) // Clear POIs from previous run
    setJobStatus(null) // Reset job status
    setJobId(null) // Clear job ID
    clearResultsForMode('marker') // Clear saved marker results

    if (window.innerWidth < 992) {
      setSheetOpen(false)
      setNotification('Please place the marker at the desired position and open the settings again.')
      setTimeout(() => setNotification(null), 5000)
    }
  }

  const handleToggleMarkerMode = () => {
    const oldMode = inputMode
    const newMode = inputMode === 'marker' ? 'track' : 'marker'
    
    // Save current results before switching
    if (jobStatus?.state === 'completed' && poiData.length > 0) {
      saveResultsForMode(oldMode, { poiData, jobStatus, jobId })
    }
    
    setLastProcessedSettings(null) // Clear snapshot when input mode changes
    
    // Load results for new mode
    const savedResults = loadResultsForMode(newMode)
    if (savedResults) {
      setPoiData(savedResults.poiData)
      setJobStatus(savedResults.jobStatus)
      setJobId(savedResults.jobId)
    } else {
      // No saved results for this mode, clear everything
      setPoiData([]) // Clear POIs from previous mode
      setJobStatus(null) // Reset job status
      setJobId(null) // Clear job ID
    }
    
    setInputMode(newMode)
    setError(null)
    
    const hasMarkerResults = savedResults?.jobStatus?.state === 'completed'

    // On mobile switching to marker mode, guide the user only if no marker results exist
    if (newMode === 'marker' && window.innerWidth < 992 && !hasMarkerResults) {
      setSheetOpen(false)
      setNotification('Please place the marker at the desired position and open the settings again.')
      // Auto-dismiss notification after 5 seconds
      setTimeout(() => setNotification(null), 5000)
    }
  }

  const handleStart = async () => {
    // Check if we have existing completed results
    if (jobStatus?.state === 'completed' && poiData.length > 0) {
      setConfirmSearchModalOpen(true)
      return
    }
    
    // Proceed with search
    await startProcessing()
  }

  const startProcessing = async () => {
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

  const handleConfirmSearch = async () => {
    setConfirmSearchModalOpen(false)
    await startProcessing()
  }

  const handleCancelSearch = () => {
    setConfirmSearchModalOpen(false)
  }

  const handleReset = () => {
    // Check if we have existing completed results
    if (jobStatus?.state === 'completed' && poiData.length > 0) {
      setConfirmResetModalOpen(true)
      return
    }
    
    // Proceed with reset
    performReset()
  }

  const performReset = () => {
    // Clear localStorage persistence
    clearPersistedSettings()
    
    setJobId(null)
    setJobStatus(null)
    setTrackData([])
    setPoiData([])
    setUploadedFile(null)
    setMarkerPosition(null)
    setError(null)
    setSheetOpen(true)
    setLastProcessedSettings(null) // Clear snapshot on reset
    setSettings({
      projectName: config?.defaults.project_name || '',
      radiusKm: config?.defaults.radius_km || 5,
      includes: config?.defaults.include || [],
      excludes: config?.defaults.exclude || [],
      presets: [],
    })
  }

  const handleConfirmReset = () => {
    setConfirmResetModalOpen(false)
    performReset()
  }

  const handleCancelReset = () => {
    setConfirmResetModalOpen(false)
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
    setLastProcessedSettings(null) // Clear snapshot when presets change
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

  // Check if search is currently running
  const isSearchRunning = useMemo(() => {
    return jobStatus?.state === 'queued' || jobStatus?.state === 'processing'
  }, [jobStatus])

  // Check if current settings match the last processed settings
  const settingsUnchanged = useMemo(() => {
    if (!lastProcessedSettings || !jobStatus || jobStatus.state !== 'completed') {
      return false
    }
    
    // Compare all relevant settings (use copies for sorting to avoid mutation)
    return (
      lastProcessedSettings.projectName === settings.projectName &&
      lastProcessedSettings.radiusKm === settings.radiusKm &&
      lastProcessedSettings.inputMode === inputMode &&
      JSON.stringify([...lastProcessedSettings.includes].sort()) === JSON.stringify([...settings.includes].sort()) &&
      JSON.stringify([...lastProcessedSettings.excludes].sort()) === JSON.stringify([...settings.excludes].sort()) &&
      JSON.stringify([...lastProcessedSettings.presets].sort()) === JSON.stringify([...settings.presets].sort()) &&
      lastProcessedSettings.fileName === uploadedFile?.name &&
      lastProcessedSettings.markerLat === markerPosition?.[0] &&
      lastProcessedSettings.markerLon === markerPosition?.[1]
    )
  }, [lastProcessedSettings, settings, inputMode, uploadedFile, markerPosition, jobStatus])

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
          background: 'var(--wa-card-bg)',
          color: 'var(--color-text)',
          padding: '0',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 170,
          boxShadow: 'var(--wa-card-shadow)',
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
        isSearchDisabled={settingsUnchanged}
        isSearchRunning={isSearchRunning}
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

      <Modal
        open={confirmSearchModalOpen}
        title="Clear Previous Results?"
        onClose={handleCancelSearch}
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-compact" onClick={handleCancelSearch}>
              Cancel
            </button>
            <button className="btn btn-primary btn-compact" onClick={handleConfirmSearch}>
              OK
            </button>
          </div>
        }
      >
        <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          Starting a new search will clear all previous results. Do you want to continue?
        </p>
      </Modal>

      <Modal
        open={confirmResetModalOpen}
        title="Reset All Data?"
        onClose={handleCancelReset}
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-compact" onClick={handleCancelReset}>
              Cancel
            </button>
            <button className="btn btn-primary btn-compact" onClick={handleConfirmReset}>
              OK
            </button>
          </div>
        }
      >
        <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          This will clear all data including saved results, settings, and uploads. Do you want to continue?
        </p>
      </Modal>
    </div>
  )
}

export default DevApp
