import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  apiClient,
  ConfigResponse,
  GeoJsonResponse,
  JobStatus,
} from './api'
import BrandingHeader from './components/BrandingHeader'
import InteractiveMap, { MapPoi, TileSource } from './components/InteractiveMap'
import SettingsSheet from './components/SettingsSheet'
import PresetSelectionModal from './components/PresetSelectionModal'
import FilterSelectionModal from './components/FilterSelectionModal'
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

const LOCAL_STORAGE_TILE_KEY = 'alonggpx.tile'

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

function DevApp() {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [trackData, setTrackData] = useState<[number, number][]>([])
  const [poiData, setPoiData] = useState<MapPoi[]>([])
  const [sheetOpen, setSheetOpen] = useState(() => window.innerWidth >= 992)
  const [tileId, setTileId] = useState<string>(loadTilePreference())
  const [pulseFab, setPulseFab] = useState(() => window.innerWidth < 992)

  const [settings, setSettings] = useState({
    projectName: '',
    radiusKm: 5,
    includes: [] as string[],
    excludes: [] as string[],
    presets: [] as string[],
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

  // Load config
  useEffect(() => {
    const load = async () => {
      try {
        const cfg = await apiClient.getConfig()
        setConfig(cfg)
        setSettings((prev) => ({
          ...prev,
          projectName: cfg.defaults.project_name,
          radiusKm: cfg.defaults.radius_km,
          includes: cfg.defaults.include,
          excludes: cfg.defaults.exclude,
        }))
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
      setError(null) // Clear any previous errors
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to parse GPX file - please check file format'
      setError(message)
      setTrackData([])
    }
  }

  const handleSettingsChange = (changes: Partial<typeof settings>) => {
    setSettings((prev) => ({ ...prev, ...changes }))
  }

  const handleStart = async () => {
    if (!uploadedFile) {
      setError('Please upload a GPX file')
      return
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
      setPoiData([]) // Clear only POIs, keep track visible

      const result = await apiClient.startProcessing(
        uploadedFile,
        settings.projectName,
        settings.radiusKm,
        settings.includes,
        settings.excludes,
        settings.presets,
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
    setJobId(null)
    setJobStatus(null)
    setTrackData([])
    setPoiData([])
    setUploadedFile(null)
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
      (p) => presetsDetail[p]?.exclude || [],
    )
    setSettings((prev) => ({
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
      const allPresetFilters = Object.values(presetsDetail).flatMap((p) => p?.include || [])
      const currentManualFilters = settings.includes.filter((f) => !allPresetFilters.includes(f))
      
      // Recalculate with remaining presets, keeping other filters from removed preset as manual
      const includesFromRemainingPresets = remainingPresets.flatMap(
        (p) => presetsDetail[p]?.include || [],
      )
      const excludesFromRemainingPresets = remainingPresets.flatMap(
        (p) => presetsDetail[p]?.exclude || [],
      )
      
      setSettings((prev) => ({
        ...prev,
        presets: remainingPresets,
        includes: Array.from(new Set([...currentManualFilters, ...filtersFromRemovedPresets, ...includesFromRemainingPresets])),
        excludes: Array.from(new Set([...prev.excludes.filter((f) => !allPresetFilters.includes(f)), ...excludesFromRemainingPresets])),
      }))
    } else {
      // Filter was manually added, just remove it
      setSettings((prev) => ({
        ...prev,
        includes: prev.includes.filter((f) => f !== filter),
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
        (p) => presetsDetail[p]?.exclude || [],
      )
      
      setSettings((prev) => ({
        ...prev,
        presets: remainingPresets,
        includes: Array.from(new Set([...prev.includes.filter((f) => !allPresetFilters.includes(f)), ...includesFromRemainingPresets])),
        excludes: Array.from(new Set([...currentManualFilters, ...filtersFromRemovedPresets, ...excludesFromRemainingPresets])),
      }))
    } else {
      // Filter was manually added, just remove it
      setSettings((prev) => ({
        ...prev,
        excludes: prev.excludes.filter((f) => f !== filter),
      }))
    }
  }

  return (
    <div className={`dev-app ${sheetOpen ? 'sheet-open' : 'sheet-closed'}`}>
      <BrandingHeader title="alongGPX" subtitle="Plan smarter along your track" />
      <InteractiveMap
        track={trackData}
        pois={poiData}
        tileSource={tileSource}
        tileOptions={TILE_SOURCES}
        onTileChange={setTileId}
      />

      <SettingsSheet
        open={sheetOpen}
        onToggle={() => setSheetOpen((prev) => !prev)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onFileSelected={handleFileSelected}
        selectedFile={uploadedFile}
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
        onSave={(filters) => {
          setSettings((prev) => ({
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
