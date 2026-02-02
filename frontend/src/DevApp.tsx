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
import Modal from './components/Modal'
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
  const [notification, setNotification] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [trackData, setTrackData] = useState<[number, number][]>([])
  const [poiData, setPoiData] = useState<MapPoi[]>([])
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null)
  const [inputMode, setInputMode] = useState<'track' | 'marker'>('track')
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
  const [helpOpen, setHelpOpen] = useState(false)

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
      setMarkerPosition(null) // Clear marker when track uploaded
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
    setSettings((prev) => ({ ...prev, ...changes }))
  }

  const handleMarkerChange = (position: [number, number] | null) => {
    setMarkerPosition(position)
    if (position) {
      setTrackData([]) // Clear track when marker placed
      setUploadedFile(null)
      setInputMode('marker')
      setError(null)
    }
  }

  const handleClearMarker = () => {
    setMarkerPosition(null)
    setPoiData([]) // Clear POIs from previous run
    setJobStatus(null) // Reset job status
    setJobId(null) // Clear job ID
    setInputMode('track')
  }

  const handleToggleMarkerMode = () => {
    if (inputMode === 'marker') {
      // Disable marker mode - clear marker and track, switch to track mode
      setMarkerPosition(null)
      setTrackData([])
      setPoiData([]) // Clear POIs from previous run
      setJobStatus(null) // Reset job status
      setJobId(null) // Clear job ID
      setInputMode('track')
      setError(null)
    } else {
      // Enable marker mode - switch to marker mode (marker position will be set by map center)
      // Clear track and uploaded file
      setMarkerPosition(null) // Will be set by InteractiveMap based on current map center
      setTrackData([])
      setUploadedFile(null)
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
        setError('Please upload a GPX file')
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

      const result = await apiClient.startProcessing(
        uploadedFile,
        settings.projectName,
        settings.radiusKm,
        settings.includes,
        settings.excludes,
        settings.presets,
        markerPosition,
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
  const openHelpModal = () => setHelpOpen(true)
  const closeHelpModal = () => setHelpOpen(false)

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
      const allPresetIncludeFilters = Object.values(presetsDetail).flatMap((p) => p?.include || [])
      const allPresetExcludeFilters = Object.values(presetsDetail).flatMap((p) => p?.exclude || [])
      const currentManualIncludes = settings.includes.filter((f) => !allPresetIncludeFilters.includes(f))
      const currentManualExcludes = settings.excludes.filter((f) => !allPresetExcludeFilters.includes(f))
      
      // Get exclude filters from removed presets that should be kept as manual
      const excludeFiltersFromRemovedPresets = presetsToRemove.flatMap(
        (p) => presetsDetail[p]?.exclude || []
      )
      
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
        includes: Array.from(new Set([...currentManualIncludes, ...filtersFromRemovedPresets, ...includesFromRemainingPresets])),
        excludes: Array.from(new Set([...currentManualExcludes, ...excludesFromRemainingPresets])),
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
      <BrandingHeader
        title="along-gpx"
        subtitle="Plan smarter along your track"
        onHelpClick={openHelpModal}
      />
      {notification && (
        <div style={{
          position: 'fixed',
          top: '52%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'white',
          color: '#1f2937',
          padding: '12px 16px',
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
        track={trackData}
        pois={poiData}
        markerPosition={markerPosition}
        onMarkerChange={handleMarkerChange}
        inputMode={inputMode}
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
        onOpenHelp={openHelpModal}
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

      <Modal open={helpOpen} title="Quickstart" onClose={closeHelpModal}>
        <div className="help-content">

          <p>
            Find points of interest (POIs) from OpenStreetMap along your GPX track or around a map marker.
            Search for campsites, water sources, shelters, and more within a custom radius.
          </p>
          
          <h4>Project Settings</h4>
          <p>
            <strong>Project name</strong>: Used for download filenames.<br />
            <strong>Search radius</strong>: How far from the track/marker to search (1-50 km).<br />
            <strong>Input mode</strong>: Choose <strong>GPX Track</strong> to search along a route, or <strong>Map Marker</strong> to search around a single point.
          </p>
          
          <h4>Input Modes</h4>
          <p>
            <strong>GPX Track</strong>: Upload a .gpx file to search for POIs along your entire route. The track appears on the map immediately after upload.<br />
            <strong>Map Marker</strong>: Place a marker directly on the map by dragging it to your desired location. Perfect for searching around a single point without uploading a file.
          </p>
          
          <h4>Presets &amp; Filters</h4>
          <p>
            <strong>Presets</strong>: Pre-configured filter sets (e.g., "Campsites", "Drinking Water").<br />
            <strong>Include filters</strong>: OSM tags to find (e.g., <code>tourism=camp_site</code>).<br />
            <strong>Exclude filters</strong>: Remove unwanted results (e.g., <code>tents=no</code>).<br />
            At least one preset or include filter is required.
          </p>
          
          <h4>Downloads</h4>
          <p>
            After processing completes, download the <strong>Excel file</strong> (table with all POIs) or the <strong>HTML map</strong> (interactive Folium map with markers).
          </p>
        </div>
      </Modal>
    </div>
  )
}

export default DevApp
