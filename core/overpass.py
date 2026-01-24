import time
import logging
import requests
import math

logger = logging.getLogger(__name__)


def build_overpass_query_batch(points, radius_km, include_filters):
    """
    Build an Overpass query with multiple circle searches batched together.
    
    Args:
        points: List of (lon, lat) tuples for query centers
        radius_km: Search radius in kilometers
        include_filters: List of OSM tag filters (e.g., ["tourism=camp_site"])
    
    Returns:
        Overpass QL query string
    """
    include_parts = []
    for inc in include_filters:
        key, value = inc.split("=", 1)
        for lon, lat in points:
            for obj_type in ("node", "way", "relation"):
                include_parts.append(
                    f'{obj_type}["{key}"="{value}"](around:{radius_km * 1000},{lat},{lon});'
                )

    include_block = "\n      ".join(include_parts)

    query = f"""
    [out:json][timeout:60];
    (
      {include_block}
    );
    out center tags;
    """
    return query


def build_overpass_query(lon, lat, radius_km, include_filters):
    """
    Build an Overpass query with dynamic include filters (single point).
    Deprecated: Use build_overpass_query_batch for better performance.
    """
    return build_overpass_query_batch([(lon, lat)], radius_km, include_filters)


def query_overpass_with_retries(query: str, overpass_cfg: dict):
    """
    Execute an Overpass query with multiple servers and retries.
    """
    servers = overpass_cfg.get("servers", [])
    retries = overpass_cfg.get("retries", 3)

    for attempt in range(retries):
        for server in servers:
            try:
                r = requests.post(server, data=query, timeout=60)
                if r.status_code == 200:
                    logger.info(f"Overpass query successful from {server}")
                    return r.json()
            except Exception as e:
                logger.debug(f"Overpass server {server} failed: {e}")
        wait = 2 * (attempt + 1)
        logger.warning(f"Overpass error – Retrying in {wait}s (attempt {attempt + 1}/{retries})")
        time.sleep(wait)

    logger.error("Overpass API permanently failed after all retries")
    return {"elements": []}


def query_overpass_segmented(
    track_points,
    track_info,
    radius_km: float,
    step_km: float,
    overpass_cfg: dict,
    include_filters: list,
):
    """
    Execute batched Overpass queries along the track.
    
    Queries are batched to reduce API calls: multiple search circles are
    combined into single requests based on batch_km configuration.
    """
    from shapely.geometry import LineString
    from pyproj import Transformer
    from tqdm import tqdm

    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    track_points_m = [transformer.transform(*p) for p in track_points]
    track_line = LineString(track_points_m)

    total_track_length_km = track_info["total_length_km"]
    track_length_m_proj = track_line.length

    def point_at_km(km):
        m = (km / total_track_length_km) * track_length_m_proj
        x, y = track_line.interpolate(m).xy
        lon, lat = transformer.transform(x[0], y[0], direction="INVERSE")
        return lon, lat

    # Calculate all query points along the track
    num_steps = math.ceil(total_track_length_km / step_km)
    query_points = []
    for step in range(num_steps + 1):
        km = min(step * step_km, total_track_length_km)
        lon, lat = point_at_km(km)
        query_points.append((lon, lat))

    # Calculate batch size based on batch_km configuration
    batch_km = overpass_cfg.get("batch_km", 50)  # Default 50km per batch
    points_per_batch = max(1, int(batch_km / step_km))
    
    # Split query points into batches
    batches = []
    for i in range(0, len(query_points), points_per_batch):
        batches.append(query_points[i:i + points_per_batch])

    logger.info(f"Querying {total_track_length_km:.1f}km track with {len(batches)} batched Overpass calls")
    logger.info(f"Search points: {len(query_points)}, ~{points_per_batch} points per batch")

    all_elements = []
    seen_ids = set()

    for batch_idx, batch_points in enumerate(tqdm(batches, desc="Overpass queries")):
        query = build_overpass_query_batch(batch_points, radius_km, include_filters)
        data = query_overpass_with_retries(query, overpass_cfg)

        for el in data.get("elements", []):
            if el["id"] in seen_ids:
                continue
            seen_ids.add(el["id"])
            all_elements.append(el)

    return all_elements
