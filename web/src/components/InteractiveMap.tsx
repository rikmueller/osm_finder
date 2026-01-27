import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './InteractiveMap.css'
import { Crosshair, Layers, Navigation } from 'lucide-react'

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
  tileSource: TileSource
  tileOptions: TileSource[]
  onTileChange: (id: string) => void
}

const COLOR_PALETTE = ['red', 'orange', 'purple', 'green', 'blue', 'lightblue']
const DEFAULT_COLOR = 'gray'

// Create custom Leaflet icon with specified color
function createColoredIcon(color: string) {
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
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
  }

  return { padTop, padLeft, padRight, padBottom, occLeft, occRight }
}

function FitBounds({ track }: { track: [number, number][] }) {
  const map = useMap()

  const userMovedRef = useRef(false)
  const lastTrackSigRef = useRef('')

  const trackSignature = useMemo(() => {
    if (!track.length) return ''
    const first = track[0]
    const last = track[track.length - 1]
    return `${track.length}:${first?.join(',')}:${last?.join(',')}`
  }, [track])

  const refit = (opts?: { force?: boolean }) => {
    if (userMovedRef.current && !opts?.force) return
    if (track.length === 0) return
    const latLngs = track.map(([lon, lat]) => [lat, lon] as [number, number])
    const bounds = L.latLngBounds(latLngs as L.LatLngExpression[])
    const { padTop, padLeft, padRight, padBottom } = computePadding()

    // Run after layout to ensure Leaflet has correct container size
    requestAnimationFrame(() => {
      map.invalidateSize()
      map.fitBounds(bounds, {
        paddingTopLeft: [padLeft, padTop],
        paddingBottomRight: [padRight, padBottom],
        animate: false,
      })
      lastTrackSigRef.current = trackSignature
    })
  }

  useEffect(() => {
    // Fit only when a new track arrives
    if (trackSignature && trackSignature !== lastTrackSigRef.current) {
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
  }, [trackSignature, map])
  return null
}

function RecenterButton({ track }: { track: [number, number][] }) {
  const map = useMap()
  const hasTrack = track.length > 0

  const handleRecenter = () => {
    if (!hasTrack) return
    const latLngs = track.map(([lon, lat]) => [lat, lon] as [number, number])
    const bounds = L.latLngBounds(latLngs as L.LatLngExpression[])
    const { padTop, padLeft, padRight, padBottom } = computePadding()

    map.invalidateSize()
    map.fitBounds(bounds, {
      paddingTopLeft: [padLeft, padTop],
      paddingBottomRight: [padRight, padBottom],
      animate: true,
    })
  }

  return (
    <button
      className="recenter-control"
      onClick={handleRecenter}
      title={hasTrack ? 'Recenter to track' : 'Load a track to recenter'}
      aria-label="Recenter to track"
      disabled={!hasTrack}
    >
      <Navigation size={18} />
    </button>
  )
}

function LocateButton() {
  const map = useMap()
  const handleLocate = () => {
    map.locate({ setView: true, maxZoom: 14 })
  }
  return (
    <button className="locate-control" onClick={handleLocate} title="Locate me" aria-label="Locate me">
      <Crosshair size={18} />
    </button>
  )
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

export default function InteractiveMap({ track, pois, tileSource, tileOptions, onTileChange }: Props) {
  const [initialCenter] = useState<[number, number]>([52.52, 13.405]) // fallback Berlin

  const polylineCoords = useMemo(() => track.map(([lon, lat]) => [lat, lon]), [track])

  // Build filter-to-color mapping based on unique filters in order of appearance
  const filterColorMap = useMemo(() => {
    const uniqueFilters = Array.from(new Set(pois.map((p) => p.matchingFilter).filter(Boolean)))
    const map: Record<string, string> = {}
    uniqueFilters.forEach((filter, idx) => {
      map[filter] = COLOR_PALETTE[idx % COLOR_PALETTE.length]
    })
    return map
  }, [pois])

  return (
    <div className="map-wrapper">
      <MapContainer
        center={(polylineCoords[0] || initialCenter) as L.LatLngExpression}
        zoom={10}
        className="map"
        zoomControl={true}
      >
        <TileLayer url={tileSource.url} attribution={tileSource.attribution} />
        {polylineCoords.length > 0 && (
          <Polyline positions={polylineCoords as L.LatLngExpression[]} pathOptions={{ color: '#2563eb', weight: 3 }} />
        )}
        {pois.map((poi) => {
          const color = poi.matchingFilter ? filterColorMap[poi.matchingFilter] || DEFAULT_COLOR : DEFAULT_COLOR
          const icon = createColoredIcon(color)
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
                  <div style={{ fontSize: '0.9em', marginTop: '2px' }}>
                    {poi.kilometersFromStart?.toFixed(1)} km from start
                  </div>
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
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Distance from start:</strong> {poi.kilometersFromStart?.toFixed(1)} km
                  </div>
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
        <FitBounds track={track} />
        <LocateButton />
        <RecenterButton track={track} />
        <TileSelector tileOptions={tileOptions} value={tileSource.id} onChange={onTileChange} />
      </MapContainer>
    </div>
  )
}
