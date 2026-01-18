from shapely.geometry import LineString, Point
from pyproj import Transformer
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
):
    """
    Apply exclusion filters, calculate distance to track, and build DataFrame.
    """
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    track_points_m = [transformer.transform(*p) for p in track_points]
    track_line = LineString(track_points_m)
    track_length_m_proj = track_line.length
    total_track_length_km = track_info["total_length_km"]

    parsed_excludes = [parse_filter(f) for f in exclude_filters]

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

        camp_point_m = Point(transformer.transform(lon2, lat2))
        distance_m = camp_point_m.distance(track_line)

        if distance_m > radius_km * 1000:
            continue

        distance_along_track_m = track_line.project(camp_point_m)
        nearest_km = (distance_along_track_m / track_length_m_proj) * total_track_length_km

        rows.append(
            {
                "lat": lat2,
                "lon": lon2,
                "Track kilometers (km)": round(nearest_km, 2),
                "Name": name,
                "Website": website,
                "Phone": phone,
                "Opening hours": opening_hours,
                "Distance to track (km)": round(distance_m / 1000, 2),
                "OSM Tags": str(tags),
            }
        )

    df = pd.DataFrame(rows).drop_duplicates()
    if not df.empty:
        df.sort_values("Track kilometers (km)", inplace=True)

    return rows, df
