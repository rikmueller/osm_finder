#!/usr/bin/env python3
import sys
import os
import logging

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.cli import parse_cli_args
from core.config import load_and_merge_config
from core.presets import load_presets, apply_presets_to_filters
from core.gpx_processing import load_gpx_track, compute_track_metrics
from core.overpass import query_overpass_segmented
from core.filtering import filter_elements_and_build_rows
from core.export import export_to_excel
from core.folium_map import build_folium_map
from datetime import datetime
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)


def run_pipeline(
    config: dict,
    cli_presets: list | None = None,
    cli_include: list | None = None,
    cli_exclude: list | None = None,
):
    """
    Core pipeline function that can be called from CLI or web app.
    
    Args:
        config: Dictionary containing all configuration (project, search, overpass, map, etc.)
    
    Returns:
        dict: Results containing paths to Excel and HTML files, dataframe, and metadata
    """
    # Generate single timestamp for both Excel and HTML files, respecting configured timezone
    timezone_str = config.get("project", {}).get("timezone", "UTC")
    try:
        tz = ZoneInfo(timezone_str)
    except Exception:
        logger.warning(f"Invalid timezone '{timezone_str}', falling back to UTC")
        tz = ZoneInfo("UTC")
    timestamp = datetime.now(tz).strftime("%Y%m%d_%H%M%S")
    
    # Load presets
    presets_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                                config.get("presets_file", "presets.yaml"))
    presets = load_presets(presets_path)

    # Apply presets to include/exclude
    include_filters, exclude_filters = apply_presets_to_filters(
        presets,
        config["search"]["include"],
        config["search"]["exclude"],
        cli_presets,
        cli_include,
        cli_exclude,
    )

    # Load GPX and prepare track
    track_points = load_gpx_track(config["input"]["gpx_file"])
    track_info = compute_track_metrics(track_points)

    # Overpass queries along the track
    elements = query_overpass_segmented(
        track_points=track_points,
        track_info=track_info,
        radius_km=config["search"]["radius_km"],
        step_km=config["search"]["step_km"],
        overpass_cfg=config["overpass"],
        include_filters=include_filters,
    )

    # Filter elements and generate tabular data
    rows, df = filter_elements_and_build_rows(
        elements=elements,
        track_points=track_points,
        track_info=track_info,
        radius_km=config["search"]["radius_km"],
        exclude_filters=exclude_filters,
        include_filters=include_filters,
    )

    # Export to Excel
    excel_path = export_to_excel(
        df=df,
        output_path=config["project"]["output_path"],
        project_name=config["project"]["name"],
        timestamp=timestamp,
    )

    # Generate Folium map
    html_path = build_folium_map(
        df=df,
        track_points=track_points,
        output_path=config["project"]["output_path"],
        project_name=config["project"]["name"],
        map_cfg=config["map"],
        include_filters=include_filters,
        timestamp=timestamp,
    )

    return {
        "excel_path": excel_path,
        "html_path": html_path,
        "dataframe": df,
        "rows_count": len(df),
        "track_length_km": track_info["total_length_km"],
    }


def main():
    """CLI entry point."""
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Read CLI arguments
    args = parse_cli_args()

    # If config path is default (not overridden), resolve it relative to repo root
    if args.config == "config.yaml":
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        args.config = os.path.join(repo_root, "config.yaml")

    # Merge configuration from YAML + CLI
    config = load_and_merge_config(args.config, args)

    try:
        result = run_pipeline(
            config,
            cli_presets=args.presets,
            cli_include=args.include,
            cli_exclude=args.exclude,
        )
        print(f"✅ Done! {result['rows_count']} objects found.")
        print(f"📄 Excel: {result['excel_path']}")
        print(f"🌍 Map: {result['html_path']}")
    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⛔ Aborted by user.")
        sys.exit(1)
