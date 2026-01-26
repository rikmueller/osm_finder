import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './InteractiveMap.css'
import { Crosshair, Layers } from 'lucide-react'

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

function FitBounds({ track }: { track: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (track.length === 0) return
    const latLngs = track.map(([lon, lat]) => [lat, lon] as [number, number])
    const bounds = L.latLngBounds(latLngs as L.LatLngExpression[])
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [track, map])
  return null
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
        <TileSelector tileOptions={tileOptions} value={tileSource.id} onChange={onTileChange} />
      </MapContainer>
    </div>
  )
}
