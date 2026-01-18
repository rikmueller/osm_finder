import os
import folium
from datetime import datetime


def build_folium_map(df, track_points, output_path: str, project_name: str, map_cfg: dict) -> str:
    """
    Generate a Folium map with track and markers.
    """
    os.makedirs(output_path, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    html_path = os.path.join(output_path, f"{project_name}_{timestamp}.html")

    start_lon, start_lat = track_points[0]

    m = folium.Map(
        location=[start_lat, start_lon],
        zoom_start=map_cfg.get("zoom_start", 10),
    )

    # Track line
    folium.PolyLine(
        [(lat, lon) for lon, lat in track_points],
        color=map_cfg.get("track_color", "blue"),
        weight=3,
        opacity=0.8,
    ).add_to(m)

    colors = map_cfg.get("marker_colors", {})
    near_color = colors.get("near", "green")
    mid_color = colors.get("mid", "orange")
    far_color = colors.get("far", "red")

    for _, row in df.iterrows():
        popup_html = f"""
        <b>{row['Name']}</b><br>
        <b>Kilometers from start:</b> {row['Kilometers from start']}<br>
        <b>Distance from track:</b> {row['Distance from track (km)']} km<br>
        <b>Website:</b> <a href="{row['Website']}" target="_blank">{row['Website']}</a><br>
        <b>Phone:</b> {row['Phone']}<br>
        <b>Opening hours:</b> {row['Opening hours']}
        """

        dist = row["Distance from track (km)"]
        if dist <= 2:
            color = near_color
        elif dist <= 5:
            color = mid_color
        else:
            color = far_color

        folium.Marker(
            location=[row["lat"], row["lon"]],
            popup=folium.Popup(popup_html, max_width=300),
            icon=folium.Icon(color=color, icon="info-sign"),
        ).add_to(m)

    m.save(html_path)
    return html_path
