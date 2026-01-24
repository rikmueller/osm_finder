import logging
import gpxpy
from pyproj import Geod

logger = logging.getLogger(__name__)


def load_gpx_track(gpx_file: str):
    """
    Load a GPX file and return a list of (lon, lat) points.
    """
    with open(gpx_file, "r", encoding="utf-8") as f:
        gpx = gpxpy.parse(f)

    track_points = [
        (p.longitude, p.latitude)
        for t in gpx.tracks
        for s in t.segments
        for p in s.points
    ]

    if not track_points:
        logger.error(f"No track points found in {gpx_file}")
        raise ValueError(f"No track points found in {gpx_file}.")
    
    logger.info(f"Loaded {len(track_points)} track points from {gpx_file}")
    return track_points


def compute_track_metrics(track_points):
    """
    Calculate geodetic track length and cumulative distances.
    """
    geod = Geod(ellps="WGS84")

    distances_km = [0.0]
    total_m = 0.0

    for i in range(1, len(track_points)):
        lon1, lat1 = track_points[i - 1]
        lon2, lat2 = track_points[i]
        _, _, d = geod.inv(lon1, lat1, lon2, lat2)
        total_m += d
        distances_km.append(total_m / 1000)

    total_track_length_km = distances_km[-1]

    return {
        "distances_km": distances_km,
        "total_length_km": total_track_length_km,
    }
