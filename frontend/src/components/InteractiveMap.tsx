import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './InteractiveMap.css'
import { Crosshair, Layers, Navigation, Play, Square } from 'lucide-react'
import { apiClient, JobStatus } from '../api'
import { renderToStaticMarkup } from 'react-dom/server'

export type TileSource = {
  id: string
  name: string
  url: string
  attribution: string
}

export type MapPoi = {
  id: string
  name: string
  coords: [number, number] // [lon, lat]
  matchingFilter: string
  kilometersFromStart: number
  distanceKm: number
  website?: string
  phone?: string
  openingHours?: string
  tags?: string
}

type Props = {
  track: [number, number][]
  pois: MapPoi[]
  markerPosition: [number, number] | null
  onMarkerChange: (position: [number, number] | null) => void
  inputMode: 'track' | 'marker'
  tileSource: TileSource
  tileOptions: TileSource[]
  onTileChange: (id: string) => void
  jobStatus: JobStatus | null
}

// Default palette (will be overridden by config.yaml values)
const DEFAULT_COLOR_PALETTE = ['orange', 'purple', 'green', 'blue', 'darkred', 'darkblue', 'darkgreen', 'cadetblue', 'pink']
const DEFAULT_COLOR = 'gray'

const MARKER_COLOR_MAP: Record<string, string> = {
  orange: 'orange',
  purple: 'violet',
  green: 'green',
  blue: 'blue',
  darkred: 'red',
  darkblue: 'blue',
  darkgreen: 'green',
  cadetblue: 'blue',
  pink: 'violet',
  gray: 'grey',
  grey: 'grey',
  red: 'red',
}

const SUPPORTED_MARKER_COLORS = new Set([
  'blue',
  'gold',
  'red',
  'green',
  'orange',
  'yellow',
  'violet',
  'grey',
  'black',
])

function normalizeMarkerColor(color: string, fallback: string) {
  const mapped = MARKER_COLOR_MAP[color] || color
  if (SUPPORTED_MARKER_COLORS.has(mapped)) {
    return mapped
  }
  return MARKER_COLOR_MAP[fallback] || fallback
}

// Create custom Leaflet icon with specified color
function createColoredIcon(color: string, fallback: string) {
  const markerColor = normalizeMarkerColor(color, fallback)
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  })
}

function createStartStopIcon(type: 'start' | 'end') {
  const isStart = type === 'start'
  const color = isStart ? 'green' : 'red'
  const markerColor = normalizeMarkerColor(color, 'blue')
  // Use hex colors to cover the white dot
  const bgColor = isStart ? '#16a34a' : '#dc2626'
  const Icon = isStart ? Play : Square
  const iconSize = 14
  // Slight left adjustment for stop icon
  const leftPos = isStart ? '50%' : 'calc(50% - 0.25px)'
  const iconMarkup = renderToStaticMarkup(<Icon size={iconSize} strokeWidth={2.5} fill="white" stroke="white" />)
  
  return L.divIcon({
    className: 'start-stop-pin-icon',
    html: `
      <div style="position: relative; width: 25px; height: 41px;">
        <img 
          src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png" 
          style="width: 25px; height: 41px; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;"
        />
        <div style="
          position: absolute;
          top: 13px;
          left: ${leftPos};
          transform: translate(-50%, -50%);
          width: 18px;
          height: 18px;
          background: ${bgColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${iconMarkup}
        </div>
      </div>
      <img 
        src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png" 
        style="position: absolute; left: 0; top: 0; width: 41px; height: 41px; z-index: -1;"
      />
    `,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  })
}

function computePadding() {
  const base = 24
  let padTop = base
  let padLeft = base
  let padRight = base
  let padBottom = base
  let occLeft = 0
  let occRight = 0

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const vpW = window.innerWidth
    const vpH = window.innerHeight
    
    // On mobile (viewport width < 768px), use minimal padding to avoid over-constraining the map
    const isMobile = vpW < 768

    const sheets = Array.from(document.querySelectorAll('.sheet')) as HTMLElement[]
    let maxLeft = 0
    let maxRight = 0
    let maxTop = 0
    let maxBottom = 0

    for (const sheet of sheets) {
      const rect = sheet.getBoundingClientRect()
      const interW = Math.max(0, Math.min(rect.right, vpW) - Math.max(rect.left, 0))
      const interH = Math.max(0, Math.min(rect.bottom, vpH) - Math.max(rect.top, 0))
      const visW = Math.min(rect.width, interW)
      const visH = Math.min(rect.height, interH)

      const isVisible = rect.right > 0 && rect.bottom > 0 && rect.left < vpW && rect.top < vpH
      if (!isVisible) continue

      const distLeft = Math.max(0, rect.left)
      const distRight = Math.max(0, vpW - rect.right)
      const distTop = Math.max(0, rect.top)
      const distBottom = Math.max(0, vpH - rect.bottom)
      const minDist = Math.min(distLeft, distRight, distTop, distBottom)

      if (minDist === distLeft && visW > 0) {
        maxLeft = Math.max(maxLeft, visW)
      } else if (minDist === distRight && visW > 0) {
        maxRight = Math.max(maxRight, visW)
      } else if (minDist === distTop && visH > 0) {
        maxTop = Math.max(maxTop, visH)
      } else if (minDist === distBottom && visH > 0) {
        maxBottom = Math.max(maxBottom, visH)
      }
    }

    if (!isMobile) {
      // Desktop: apply full padding from sheets
      if (maxLeft > 0) {
        padLeft += maxLeft
        occLeft += maxLeft
      }
      if (maxRight > 0) {
        padRight += maxRight
        occRight += maxRight
      }
      if (maxTop > 0) padTop += maxTop
      if (maxBottom > 0) padBottom += maxBottom
    } else {
      // Mobile: only add padding from sheets if they don't cover too much area
      // If a sheet covers >30% of viewport on any side, skip padding from that side
      const maxAreaRatio = 0.3
      if (maxLeft > 0 && maxLeft < vpW * maxAreaRatio) {
        padLeft += maxLeft
        occLeft += maxLeft
      }
      if (maxRight > 0 && maxRight < vpW * maxAreaRatio) {
        padRight += maxRight
        occRight += maxRight
      }
      if (maxTop > 0 && maxTop < vpH * maxAreaRatio) {
        padTop += maxTop
      }
      if (maxBottom > 0 && maxBottom < vpH * maxAreaRatio) {
        padBottom += maxBottom
      }
    }
  }

  return { padTop, padLeft, padRight, padBottom, occLeft, occRight }
}

function FitBounds({ track, pois }: { track: [number, number][]; pois: MapPoi[] }) {
  const map = useMap()

  const userMovedRef = useRef(false)
  const lastSigRef = useRef('')

  const signature = useMemo(() => {
    const tLen = track.length
    const pLen = pois.length
    if (!tLen && !pLen) return ''
    const tFirst = tLen ? track[0] : []
    const tLast = tLen ? track[tLen - 1] : []
    const pFirst = pLen ? pois[0].coords : []
    const pLast = pLen ? pois[pLen - 1].coords : []
    return `${tLen}:${tFirst?.join(',')}:${tLast?.join(',')}:${pLen}:${pFirst?.join(',')}:${pLast?.join(',')}`
  }, [track, pois])

  const refit = (opts?: { force?: boolean }) => {
    if (userMovedRef.current && !opts?.force) return
    const points: [number, number][] = []
    track.forEach(([lon, lat]) => points.push([lat, lon]))
    pois.forEach((p) => points.push([p.coords[1], p.coords[0]]))
    if (!points.length) return
    const bounds = L.latLngBounds(points as L.LatLngExpression[])
    
    // Use double requestAnimationFrame for better mobile compatibility
    // First frame ensures DOM is rendered, second ensures map container is sized
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Force map to recalculate its size before computing padding
        map.invalidateSize({ pan: false })
        
        // Wait longer for mobile layouts to fully settle (increased from 50ms)
        setTimeout(() => {
          const { padTop, padLeft, padRight, padBottom } = computePadding()
          map.fitBounds(bounds, {
            paddingTopLeft: [padLeft, padTop],
            paddingBottomRight: [padRight, padBottom],
            maxZoom: 14, // Prevent excessive zoom-in on mobile
            animate: false,
          })
          lastSigRef.current = signature
        }, 150)
      })
    })
  }

  useEffect(() => {
    // Reset user interaction flag when data is cleared (reset case)
    if (!signature && lastSigRef.current) {
      userMovedRef.current = false
      lastSigRef.current = ''
    }
    
    // Fit only when a new track/POI data arrives
    if (signature && signature !== lastSigRef.current) {
      userMovedRef.current = false
      refit({ force: true })
    }

    const onMoveStart = () => { userMovedRef.current = true }
    const onZoomStart = () => { userMovedRef.current = true }
    map.on('movestart', onMoveStart)
    map.on('zoomstart', onZoomStart)

    return () => {
      map.off('movestart', onMoveStart)
      map.off('zoomstart', onZoomStart)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map])
  return null
}

function RecenterButton({ track, pois, markerPosition }: { track: [number, number][]; pois: MapPoi[]; markerPosition: [number, number] | null }) {
  const map = useMap()
  const hasTrack = track.length > 0
  const hasPois = pois.length > 0
  const hasMarker = markerPosition !== null
  const hasAny = hasTrack || hasPois || hasMarker

  const handleRecenter = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!hasAny) return
    const points: [number, number][] = []
    track.forEach(([lon, lat]) => points.push([lat, lon]))
    pois.forEach((p) => points.push([p.coords[1], p.coords[0]]))
    if (markerPosition) points.push([markerPosition[0], markerPosition[1]])
    
    const bounds = L.latLngBounds(points as L.LatLngExpression[])
    
    // Force recalculation of map size (crucial for mobile)
    map.invalidateSize({ pan: false })
    
    // Compute padding after invalidateSize to get correct dimensions
    const { padTop, padLeft, padRight, padBottom } = computePadding()

    // Use setTimeout to ensure padding calculations are based on updated layout
    setTimeout(() => {
      map.fitBounds(bounds, {
        paddingTopLeft: [padLeft, padTop],
        paddingBottomRight: [padRight, padBottom],
        maxZoom: 14, // Prevent excessive zoom-in on mobile (applies to single points too)
        animate: true,
      })
    }, 10)
  }

  return (
    <button
      className="recenter-control"
      onClick={handleRecenter}
      title={hasAny ? 'Recenter to data' : 'Load data to recenter'}
      aria-label="Recenter to data"
      disabled={!hasAny}
    >
      <Navigation size={18} />
    </button>
  )
}

function LocateButton() {
  const map = useMap()
  const [isLocating, setIsLocating] = useState(false)

  useEffect(() => {
    const onLocationFound = (e: L.LocationEvent) => {
      setIsLocating(false)
      map.setView(e.latlng, Math.max(map.getZoom(), 14))
    }

    const onLocationError = () => {
      setIsLocating(false)
    }

    map.on('locationfound', onLocationFound)
    map.on('locationerror', onLocationError)

    return () => {
      map.off('locationfound', onLocationFound)
      map.off('locationerror', onLocationError)
      map.stopLocate()
    }
  }, [map])

  const handleLocate = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isLocating) return
    setIsLocating(true)
    map.locate({
      setView: false,
      maxZoom: 14,
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 30000 // Accept cached position up to 30 seconds old
    })
  }

  return (
    <button 
      className={`locate-control ${isLocating ? 'locating' : ''}`}
      onClick={handleLocate} 
      title="Locate me" 
      aria-label="Locate me"
      disabled={isLocating}
    >
      <Crosshair size={18} />
    </button>
  )
}

function ScaleControl() {
  const map = useMap()

  useEffect(() => {
    const scaleControl = L.control.scale({
      position: 'bottomleft',
      imperial: false,
      metric: true,
    })
    scaleControl.addTo(map)

    return () => {
      scaleControl.remove()
    }
  }, [map])

  return null
}

function TileSelector({ tileOptions, value, onChange }: { tileOptions: TileSource[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="tile-control-wrapper">
      <button
        className="tile-control"
        onClick={() => setOpen((p) => !p)}
        title="Switch map tiles"
        aria-label="Switch map tiles"
      >
        <Layers size={18} />
      </button>
      {open && (
        <div className="tile-popover" role="menu">
          {tileOptions.map((opt) => (
            <button
              key={opt.id}
              className={`tile-option ${opt.id === value ? 'active' : ''}`}
              onClick={() => {
                onChange(opt.id)
                setOpen(false)
              }}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  const map = useMap()

  useEffect(() => {
    const handleClick = (e: L.LeafletMouseEvent) => {
      // Ignore clicks on buttons or control elements
      const target = e.originalEvent?.target as HTMLElement
      if (target && (target.closest('button') || target.closest('.leaflet-control'))) {
        return
      }
      onMapClick(e.latlng.lat, e.latlng.lng)
    }

    map.on('click', handleClick)

    return () => {
      map.off('click', handleClick)
    }
  }, [map, onMapClick])

  return null
}

export default function InteractiveMap({ track, pois, markerPosition, onMarkerChange, inputMode, tileSource, tileOptions, onTileChange, jobStatus }: Props) {
  const initialCenter: [number, number] = [49.0069, 8.4037] // fallback Karlsruhe
  const [colorPalette, setColorPalette] = useState<string[]>(DEFAULT_COLOR_PALETTE)
  const [trackColor, setTrackColor] = useState<string>('#2563eb')
  const markerRef = useRef<L.Marker>(null)

  // Determine if marker should be locked (during processing or after completion, but not on failure)
  const isMarkerLocked = jobStatus && (
    jobStatus.state === 'processing' || 
    jobStatus.state === 'completed'
  )

  // Handle map click to place or reposition marker
  const handleMapClick = (lat: number, lon: number) => {
    // In marker mode, clicking map places or repositions marker (unless locked)
    if (inputMode === 'marker' && !isMarkerLocked) {
      onMarkerChange([lat, lon])
    }
  }

  // Handle marker drag to update position
  const handleMarkerDrag = () => {
    if (markerRef.current) {
      const pos = markerRef.current.getLatLng()
      onMarkerChange([pos.lat, pos.lng])
    }
  }

  // Create marker icon using track color
  const markerIcon = useMemo(() => {
    // Use same design as start pin - green with Play icon
    const color = 'green'
    const markerColor = normalizeMarkerColor(color, 'blue')
    const bgColor = '#16a34a'
    const iconSize = 14
    const iconMarkup = renderToStaticMarkup(<Play size={iconSize} strokeWidth={2.5} fill="white" stroke="white" />)
    
    return L.divIcon({
      className: 'search-marker-icon',
      html: `
        <div style="position: relative; width: 25px; height: 41px;">
          <img 
            src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png" 
            style="width: 25px; height: 41px; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;"
          />
          <div style="
            position: absolute;
            top: 13px;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 18px;
            height: 18px;
            background: ${bgColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${iconMarkup}
          </div>
        </div>
        <img 
          src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png" 
          style="position: absolute; left: 0; top: 0; width: 41px; height: 41px; z-index: -1;"
        />
      `,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    })
  }, [])

  // Load color palette and track color from config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await apiClient.getConfig()
        // Extract palette and track color from config
        const response = config as any
        if (response.marker_color_palette && Array.isArray(response.marker_color_palette)) {
          setColorPalette(response.marker_color_palette)
        }
        if (response.track_color) {
          setTrackColor(response.track_color)
        }
      } catch (err) {
        console.debug('Could not load config, using defaults', err)
        setColorPalette(DEFAULT_COLOR_PALETTE)
        setTrackColor('#2563eb')
      }
    }
    loadConfig()
  }, [])

  // Automatic geolocation detection disabled to prevent browser popup
  // Users can still manually click the locate button on the map if desired

  const polylineCoords = useMemo(() => track.map(([lon, lat]) => [lat, lon]), [track])

  // Build filter-to-color mapping based on unique filters in order of appearance
  const filterColorMap = useMemo(() => {
    const uniqueFilters = Array.from(new Set(pois.map((p) => p.matchingFilter).filter(Boolean)))
    const map: Record<string, string> = {}
    uniqueFilters.forEach((filter, idx) => {
      map[filter] = colorPalette[idx % colorPalette.length]
    })
    return map
  }, [pois, colorPalette])

  // Helper component to center marker on map when switching to marker mode
  function MarkerModeSwitchHandler({ onMarkerChange, inputMode, markerPosition }: { onMarkerChange: (pos: [number, number]) => void; inputMode: string; markerPosition: [number, number] | null }) {
    const map = useMap()
    
    useEffect(() => {
      if (inputMode === 'marker' && markerPosition === null) {
        // Just switched to marker mode without a marker - place at map center
        const center = map.getCenter()
        onMarkerChange([center.lat, center.lng])
      }
    }, [inputMode, markerPosition, onMarkerChange, map])
    
    return null
  }

  return (
    <div className="map-wrapper">
      <MapContainer
        center={(polylineCoords[0] || initialCenter) as L.LatLngExpression}
        zoom={10}
        className="map"
        zoomControl={true}
      >
        <TileLayer url={tileSource.url} attribution={tileSource.attribution} />
        <MapClickHandler onMapClick={handleMapClick} />
        <MarkerModeSwitchHandler onMarkerChange={onMarkerChange} inputMode={inputMode} markerPosition={markerPosition} />
        
        {/* User-placed marker (draggable) - only visible in marker mode */}
        {markerPosition && inputMode === 'marker' && (
          <Marker
            position={[markerPosition[0], markerPosition[1]]}
            icon={markerIcon}
            draggable={!isMarkerLocked}
            ref={markerRef}
            eventHandlers={{
              dragend: handleMarkerDrag,
            }}
          >
            <Popup>
              <div>
                <strong>Search Center</strong><br />
                {markerPosition[0].toFixed(5)}°N, {markerPosition[1].toFixed(5)}°E
                {isMarkerLocked && (
                  <div style={{ marginTop: '8px', fontSize: '0.9em', fontStyle: 'italic', opacity: 0.7 }}>
                    Hit reset to move marker (all results will be cleared).
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}
        
        {polylineCoords.length > 0 && (
          <Polyline positions={polylineCoords as L.LatLngExpression[]} pathOptions={{ color: trackColor, weight: 3 }} />
        )}
        {polylineCoords.length > 0 && (
          <>
            <Marker 
              position={polylineCoords[0] as L.LatLngExpression}
              icon={createStartStopIcon('start')}
            >
              <Popup><strong>Start</strong></Popup>
            </Marker>
            {polylineCoords.length > 1 && (
              <Marker 
                position={polylineCoords[polylineCoords.length - 1] as L.LatLngExpression}
                icon={createStartStopIcon('end')}
              >
                <Popup><strong>End</strong></Popup>
              </Marker>
            )}
          </>
        )}
        {pois.map((poi) => {
          const color = poi.matchingFilter ? filterColorMap[poi.matchingFilter] || DEFAULT_COLOR : DEFAULT_COLOR
          const icon = createColoredIcon(color, DEFAULT_COLOR)
          return (
            <Marker 
              key={poi.id} 
              position={[poi.coords[1], poi.coords[0]]} 
              icon={icon}
              eventHandlers={{
                click: (e) => {
                  // Close tooltip when marker is clicked to show popup
                  e.target.closeTooltip()
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                <div>
                  <strong>{poi.name}</strong>
                  {inputMode === 'track' && (
                    <div style={{ fontSize: '0.9em', marginTop: '2px' }}>
                      {poi.kilometersFromStart?.toFixed(1)} km from start
                    </div>
                  )}
                  <div style={{ fontSize: '0.8em', marginTop: '4px', fontStyle: 'italic', opacity: 0.8 }}>
                    Click for more details
                  </div>
                </div>
              </Tooltip>
              <Popup maxWidth={300}>
                <div style={{ minWidth: '200px' }}>
                  <strong style={{ fontSize: '1.1em', display: 'block', marginBottom: '8px' }}>
                    {poi.name}
                  </strong>
                  {poi.matchingFilter && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Filter:</strong> {poi.matchingFilter}
                    </div>
                  )}
                  {inputMode === 'track' && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Distance from start:</strong> {poi.kilometersFromStart?.toFixed(1)} km
                    </div>
                  )}
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Distance from track:</strong> {poi.distanceKm?.toFixed(2)} km
                  </div>
                  {poi.website && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Website:</strong>{' '}
                      <a href={poi.website} target="_blank" rel="noopener noreferrer">
                        {poi.website}
                      </a>
                    </div>
                  )}
                  {poi.phone && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Phone:</strong> {poi.phone}
                    </div>
                  )}
                  {poi.openingHours && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Opening hours:</strong> {poi.openingHours}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
        <FitBounds track={track} pois={pois} />
        <ScaleControl />
        <LocateButton />
        <RecenterButton track={track} pois={pois} markerPosition={markerPosition} />
        <TileSelector tileOptions={tileOptions} value={tileSource.id} onChange={onTileChange} />
      </MapContainer>
    </div>
  )
}
