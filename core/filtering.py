from shapely.geometry import LineString, Point
from pyproj import Transformer, Geod
import pandas as pd


def parse_filter(filter_str: str):
    key, value = filter_str.split("=", 1)
    return key.strip(), value.strip()


def filter_elements_and_build_rows(
    elements,
    track_points,
    track_info,
    radius_km: float,
    exclude_filters: list,
    include_filters: list = None,
):
    """
    Apply exclusion filters, calculate distance to track, identify matching filter, and build DataFrame.
    """
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    track_points_m = [transformer.transform(*p) for p in track_points]
    track_line = LineString(track_points_m)
    track_length_m_proj = track_line.length
    total_track_length_km = track_info["total_length_km"]

    # Use geodesic calculations for accurate distance measurements
    geod = Geod(ellps="WGS84")

    parsed_excludes = [parse_filter(f) for f in exclude_filters]
    parsed_includes = [parse_filter(f) for f in (include_filters or [])]

    rows = []

    for el in elements:
        lat2 = el.get("lat") or el.get("center", {}).get("lat")
        lon2 = el.get("lon") or el.get("center", {}).get("lon")
        if lat2 is None or lon2 is None:
            continue

        tags = el.get("tags", {})

        # Exclusion filters
        exclude_hit = False
        for key, value in parsed_excludes:
            if tags.get(key) == value:
                exclude_hit = True
                break
        if exclude_hit:
            continue

        name = tags.get("name", "Unnamed")

        website = (
            tags.get("website")
            or tags.get("contact:website")
            or tags.get("url")
            or ""
        )

        phone = (
            tags.get("phone")
            or tags.get("contact:phone")
            or tags.get("contact:mobile")
            or ""
        )

        opening_hours = tags.get("opening_hours", "")

        # Calculate minimum distance to any segment and position along track using geodesic distance
        min_distance_m = float('inf')
        cumulative_distance_km = 0
        closest_position_km = 0
        
        for i in range(len(track_points) - 1):
            p1_lon, p1_lat = track_points[i]
            p2_lon, p2_lat = track_points[i + 1]
            
            # Distance from POI to start of segment
            _, _, dist_to_p1 = geod.inv(lon2, lat2, p1_lon, p1_lat)
            
            # Distance from POI to end of segment
            _, _, dist_to_p2 = geod.inv(lon2, lat2, p2_lon, p2_lat)
            
            # Distance of this segment
            _, _, segment_length = geod.inv(p1_lon, p1_lat, p2_lon, p2_lat)
            
            # Find closest point on this segment
            if dist_to_p1 < min_distance_m:
                min_distance_m = dist_to_p1
                closest_position_km = cumulative_distance_km
            
            if dist_to_p2 < min_distance_m:
                min_distance_m = dist_to_p2
                closest_position_km = cumulative_distance_km + segment_length / 1000
            
            cumulative_distance_km += segment_length / 1000

        if min_distance_m > radius_km * 1000:
            continue

        # Identify which include filter matched
        matching_filter = ""
        for inc_key, inc_value in parsed_includes:
            if tags.get(inc_key) == inc_value:
                matching_filter = f"{inc_key}={inc_value}"
                break

        rows.append(
            {
                "Kilometers from start": round(closest_position_km, 2),
                "Distance from track (km)": round(min_distance_m / 1000, 2),
                "Matching Filter": matching_filter,
                "Name": name,
                "Website": website,
                "Phone": phone,
                "Opening hours": opening_hours,
                "OSM Tags": str(tags),
                "lat": lat2,
                "lon": lon2
            }
        )

    df = pd.DataFrame(rows).drop_duplicates()
    if not df.empty:
        df.sort_values("Kilometers from start", inplace=True)

    return rows, df
