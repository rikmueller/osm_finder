#!/usr/bin/env python3
import sys
from core.cli import parse_cli_args
from core.config import load_and_merge_config
from core.presets import load_presets, apply_presets_to_filters
from core.gpx_processing import load_gpx_track, compute_track_metrics
from core.overpass import query_overpass_segmented
from core.filtering import filter_elements_and_build_rows
from core.export import export_to_excel
from core.folium_map import build_folium_map


def main():
    # Read CLI arguments
    args = parse_cli_args()

    # Merge configuration from YAML + CLI
    config = load_and_merge_config(args.config, args)

    # Load presets
    presets = load_presets(config.get("presets_file", "presets.yaml"))

    # Apply presets to include/exclude
    include_filters, exclude_filters = apply_presets_to_filters(
        presets,
        config["search"]["include"],
        config["search"]["exclude"],
        args.presets,
        args.include,
        args.exclude,
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
    )

    # Generate Folium map
    html_path = build_folium_map(
        df=df,
        track_points=track_points,
        output_path=config["project"]["output_path"],
        project_name=config["project"]["name"],
        map_cfg=config["map"],
        include_filters=include_filters,
    )

    print(f"✅ Done! {len(df)} objects found.")
    print(f"📄 Excel: {excel_path}")
    print(f"🌍 Map: {html_path}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⛔ Aborted by user.")
        sys.exit(1)
