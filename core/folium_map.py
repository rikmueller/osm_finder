import os
import folium
from folium.plugins import LocateControl
from datetime import datetime


def build_folium_map(df, track_points, output_path: str, project_name: str, map_cfg: dict, include_filters: list = None) -> str:
    """
    Generate a Folium map with track and markers.
    Marker colors are assigned based on filter rank.
    """
    os.makedirs(output_path, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    html_path = os.path.join(output_path, f"{project_name}_{timestamp}.html")

    start_lon, start_lat = track_points[0]

    m = folium.Map(
        location=[start_lat, start_lon],
        zoom_start=map_cfg.get("zoom_start", 10),
    )

    # Add locate control button
    LocateControl(position='topleft').add_to(m)

    # Track line
    folium.PolyLine(
        [(lat, lon) for lon, lat in track_points],
        color=map_cfg.get("track_color", "blue"),
        weight=3,
        opacity=0.8,
    ).add_to(m)

    # Get color palette and create filter-to-color mapping by rank
    color_palette = map_cfg.get("marker_color_palette", ["red", "orange", "purple", "green", "blue"])
    default_color = map_cfg.get("default_marker_color", "gray")
    
    filter_to_color = {}
    if include_filters:
        for idx, filt in enumerate(include_filters):
            color = color_palette[idx % len(color_palette)] if color_palette else default_color
            filter_to_color[filt] = color

    for _, row in df.iterrows():
        popup_html = f"""
        <b>{row['Name']}</b><br>
        <b>Kilometers from start:</b> {row['Kilometers from start']}<br>
        <b>Distance from track:</b> {row['Distance from track (km)']} km<br>
        <b>Filter:</b> {row.get('Matching Filter', 'N/A')}<br>
        <b>Website:</b> <a href="{row['Website']}" target="_blank">{row['Website']}</a><br>
        <b>Phone:</b> {row['Phone']}<br>
        <b>Opening hours:</b> {row['Opening hours']}
        """

        # Get color based on filter rank
        matching_filter = row.get("Matching Filter", "")
        color = filter_to_color.get(matching_filter, default_color)

        folium.Marker(
            location=[row["lat"], row["lon"]],
            popup=folium.Popup(popup_html, max_width=300),
            icon=folium.Icon(color=color, icon="info-sign"),
        ).add_to(m)

    m.save(html_path)
    return html_path
