import os
import json
import folium
from string import Template
from folium.plugins import LocateControl


def build_folium_map(
    df,
    track_points,
    output_path: str,
    project_name: str,
    map_cfg: dict,
    include_filters: list | None = None,
    filename: str | None = None,
) -> str:
    """
    Generate a Folium map with track and markers.
    Marker colors are assigned based on filter rank.
    
    Args:
        df: DataFrame with POI data
        track_points: List of (lon, lat) track coordinates
        output_path: Output directory
        project_name: Project name (unused, kept for compatibility)
        map_cfg: Map configuration dict
        include_filters: List of include filters for color coding
        filename: Filename to use (e.g., UUID-based). If None, uses project_name.html
    
    Returns:
        Path to generated HTML file
    """
    os.makedirs(output_path, exist_ok=True)
    if filename is None:
        filename = f"{project_name}.html"
    elif not filename.endswith('.html'):
        filename = f"{filename}.html"
    html_path = os.path.join(output_path, filename)

    start_lon, start_lat = track_points[0]

    # Default tiles if none provided in config
    tile_layers = map_cfg.get("tile_layers") or [
        {
            "name": "OpenStreetMap",
            "tiles": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "attr": "&copy; OpenStreetMap contributors",
        },
        {
            "name": "OpenTopoMap",
            "tiles": "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
            "attr": "&copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap",
        },
        {
            "name": "CyclOSM",
            "tiles": "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
            "attr": "&copy; OpenStreetMap contributors | CyclOSM",
        },
    ]

    m = folium.Map(
        location=[start_lat, start_lon],
        tiles=None,  # We add explicit tile layers below so the user can switch
    )

    for idx, layer in enumerate(tile_layers):
        folium.TileLayer(
            tiles=layer.get("tiles"),
            name=layer.get("name", "Base"),
            attr=layer.get("attr"),
            overlay=False,
            control=True,
            show=(idx == 0),
        ).add_to(m)

    # Add locate control button
    LocateControl(position="topleft").add_to(m)

    # Add recenter control to fit track + POI bounds (when data exists)
    track_latlon = [[lat, lon] for lon, lat in track_points] if track_points else []
    poi_latlon = [[row["lat"], row["lon"]] for _, row in (df.iterrows() if df is not None else [])]
    recenter_style = """
    <style>
        .leaflet-bar.folium-recenter-control {
            border-radius: 4px;
        }
        .leaflet-bar.folium-recenter-control a {
            width: 30px;
            height: 30px;
            line-height: 30px;
            display: block;
            text-align: center;
            text-decoration: none;
            color: #333;
            background: #fff;
            border: 1px solid #ccc;
            font-size: 18px;
        }
        .leaflet-bar.folium-recenter-control a:first-child {
            border-radius: 4px 4px 0 0;
        }
        .leaflet-bar.folium-recenter-control a:last-child {
            border-radius: 0 0 4px 4px;
            border-top: none;
        }
        .leaflet-bar.folium-recenter-control a:hover {
            background: #f5f5f5;
        }
        .leaflet-bar.folium-recenter-control a.disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: #f9fafb;
        }
    </style>
    """

    recenter_template = Template("""
    <script>
        (function() {
            var track = $track;
            var poi = $poi;
            var mapName = "$map_name";
            var attempts = 0;
            function attach() {
                var map = window[mapName];
                if (!map) {
                    if (attempts++ < 50) return setTimeout(attach, 100);
                    return;
                }
                
                var control = L.control({ position: 'topleft' });
                control.onAdd = function() {
                    var container = L.DomUtil.create('div', 'leaflet-bar folium-recenter-control');
                    var link = L.DomUtil.create('a', '', container);
                    link.href = '#';
                    var hasTrack = track.length > 0;
                    var hasPois = poi.length > 0;
                    var hasAny = hasTrack || hasPois;
                    link.title = hasAny ? 'Recenter to data' : 'Load data to recenter';
                    link.setAttribute('role', 'button');
                    link.setAttribute('aria-label', link.title);
                    link.innerHTML = '\u27f2';
                    if (!hasAny) {
                        link.classList.add('disabled');
                    }
                    
                    L.DomEvent.disableClickPropagation(link);
                    L.DomEvent.on(link, 'click', function (e) {
                        L.DomEvent.preventDefault(e);
                        if (!hasAny) return;
                        var points = track.concat(poi);
                        var bounds = L.latLngBounds(points.map(function(p) { return [p[0], p[1]]; }));
                        map.fitBounds(bounds, { padding: [24, 24] });
                    });
                    
                    return container;
                };
                control.addTo(map);
            }
            attach();
        })();
    </script>
    """)
    recenter_script = recenter_template.substitute(
        track=json.dumps(track_latlon),
        poi=json.dumps(poi_latlon),
        map_name=m.get_name(),
    )

    m.get_root().html.add_child(folium.Element(recenter_style))
    m.get_root().html.add_child(folium.Element(recenter_script))

    # Overlays for track and POIs so they appear in the layer control
    track_group = folium.FeatureGroup(name="Track", overlay=True, show=True)
    poi_group = folium.FeatureGroup(name="Points of Interest", overlay=True, show=True)

    folium.PolyLine(
        [(lat, lon) for lon, lat in track_points],
        color=map_cfg.get("track_color", "blue"),
        weight=3,
        opacity=0.8,
    ).add_to(track_group)

    # Add start marker
    if track_points:
        start_lon, start_lat = track_points[0]
        folium.Marker(
            location=[start_lat, start_lon],
            popup=folium.Popup("<b>Start</b>", max_width=150),
            icon=folium.Icon(color="green", icon="play", prefix="glyphicon"),
        ).add_to(track_group)

    # Add end marker
    if track_points and len(track_points) > 1:
        end_lon, end_lat = track_points[-1]
        folium.Marker(
            location=[end_lat, end_lon],
            popup=folium.Popup("<b>End</b>", max_width=150),
            icon=folium.Icon(color="red", icon="stop", prefix="glyphicon"),
        ).add_to(track_group)

    # Collect bounds from track and POIs for initial auto-fit
    bounds = [[lat, lon] for lon, lat in track_points] if track_points else []

    # Detect marker mode (single-point track)
    is_marker_mode = len(track_points) < 2

    # Get color palette and create filter-to-color mapping by rank
    color_palette = map_cfg.get("marker_color_palette", ["red", "orange", "purple", "green", "blue"])
    default_color = map_cfg.get("default_marker_color", "gray")

    filter_to_color = {}
    if include_filters:
        for idx, filt in enumerate(include_filters):
            color = color_palette[idx % len(color_palette)] if color_palette else default_color
            filter_to_color[filt] = color

    for _, row in df.iterrows():
        bounds.append([row["lat"], row["lon"]])
        # Build popup HTML conditionally based on track mode
        distance_from_start_html = "" if is_marker_mode else f"<b>Kilometers from start:</b> {row['Kilometers from start']}<br>"
        popup_html = f"""
        <b>{row['Name']}</b><br>
        {distance_from_start_html}<b>Distance from track:</b> {row['Distance from track (km)']} km<br>
        <b>Filter:</b> {row.get('Matching Filter', 'N/A')}<br>
        <b>Website:</b> <a href="{row['Website']}" target="_blank">{row['Website']}</a><br>
        <b>Phone:</b> {row['Phone']}<br>
        <b>Opening hours:</b> {row['Opening hours']}
        """

        matching_filter = row.get("Matching Filter", "")
        color = filter_to_color.get(matching_filter, default_color)

        folium.Marker(
            location=[row["lat"], row["lon"]],
            popup=folium.Popup(popup_html, max_width=300),
            icon=folium.Icon(color=color, icon="info-sign"),
        ).add_to(poi_group)

    if bounds:
        m.fit_bounds(bounds, padding=(24, 24))

    track_group.add_to(m)
    poi_group.add_to(m)

    folium.LayerControl(
        position=map_cfg.get("layer_control_position", "topright"),
        collapsed=map_cfg.get("layer_control_collapsed", False),
    ).add_to(m)

    # Add scale control
    scale_script = Template("""
    <script>
        (function() {
            var mapName = "$map_name";
            var attempts = 0;
            function attach() {
                var map = window[mapName];
                if (!map) {
                    if (attempts++ < 50) return setTimeout(attach, 100);
                    return;
                }
                
                L.control.scale({
                    position: 'bottomleft',
                    imperial: false,
                    metric: true
                }).addTo(map);
            }
            attach();
        })();
    </script>
    """)
    m.get_root().html.add_child(folium.Element(scale_script.substitute(map_name=m.get_name())))

    m.save(html_path)
    return html_path
