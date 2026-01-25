import os
import yaml
from dotenv import load_dotenv


def load_yaml_config(path: str) -> dict:
    """
    Load a YAML configuration file.
    """
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_env_config() -> dict:
    """
    Load configuration from environment variables.
    Supports overriding specific config values.
    
    Environment variables:
    - ALONGGPX_PROJECT_NAME
    - ALONGGPX_OUTPUT_PATH
    - ALONGGPX_GPX_FILE
    - ALONGGPX_RADIUS_KM
    - ALONGGPX_STEP_KM
    - ALONGGPX_BATCH_KM
    - ALONGGPX_MAP_ZOOM_START
    - ALONGGPX_OVERPASS_RETRIES
    """
    # Load .env file if present
    load_dotenv()
    
    env_cfg = {}
    
    if os.getenv("ALONGGPX_PROJECT_NAME"):
        env_cfg["project_name"] = os.getenv("ALONGGPX_PROJECT_NAME")
    if os.getenv("ALONGGPX_OUTPUT_PATH"):
        env_cfg["output_path"] = os.getenv("ALONGGPX_OUTPUT_PATH")
    if os.getenv("ALONGGPX_GPX_FILE"):
        env_cfg["gpx_file"] = os.getenv("ALONGGPX_GPX_FILE")
    if os.getenv("ALONGGPX_RADIUS_KM"):
        env_cfg["radius_km"] = float(os.getenv("ALONGGPX_RADIUS_KM"))
    if os.getenv("ALONGGPX_STEP_KM"):
        env_cfg["step_km"] = float(os.getenv("ALONGGPX_STEP_KM"))
    if os.getenv("ALONGGPX_BATCH_KM"):
        env_cfg["batch_km"] = float(os.getenv("ALONGGPX_BATCH_KM"))
    if os.getenv("ALONGGPX_MAP_ZOOM_START"):
        env_cfg["map_zoom_start"] = int(os.getenv("ALONGGPX_MAP_ZOOM_START"))
    if os.getenv("ALONGGPX_OVERPASS_RETRIES"):
        env_cfg["overpass_retries"] = int(os.getenv("ALONGGPX_OVERPASS_RETRIES"))
    if os.getenv("ALONGGPX_TIMEZONE"):
        env_cfg["timezone"] = os.getenv("ALONGGPX_TIMEZONE")
    
    return env_cfg


def merge_cli_into_config(cfg: dict, args) -> dict:
    """
    Merge CLI arguments into YAML configuration.
    Only set CLI values override YAML.
    """
    if args.project_name:
        cfg["project"]["name"] = args.project_name
    if args.output_path:
        cfg["project"]["output_path"] = args.output_path
    if args.gpx_file:
        cfg["input"]["gpx_file"] = args.gpx_file
    if args.radius_km is not None:
        cfg["search"]["radius_km"] = args.radius_km
    if args.step_km is not None:
        cfg["search"]["step_km"] = args.step_km

    # STEP_KM: if None → 60% of radius_km
    if cfg["search"]["step_km"] is None:
        cfg["search"]["step_km"] = cfg["search"]["radius_km"] * 0.6

    # Normalize output path
    cfg["project"]["output_path"] = os.path.abspath(cfg["project"]["output_path"])

    return cfg


def merge_env_into_config(cfg: dict, env_cfg: dict) -> dict:
    """
    Merge environment variable configuration into YAML configuration.
    Environment variables have lower precedence than CLI but override YAML defaults.
    """
    if "project_name" in env_cfg:
        cfg["project"]["name"] = env_cfg["project_name"]
    if "output_path" in env_cfg:
        cfg["project"]["output_path"] = env_cfg["output_path"]
    if "gpx_file" in env_cfg:
        cfg["input"]["gpx_file"] = env_cfg["gpx_file"]
    if "radius_km" in env_cfg:
        cfg["search"]["radius_km"] = env_cfg["radius_km"]
    if "step_km" in env_cfg:
        cfg["search"]["step_km"] = env_cfg["step_km"]
    if "batch_km" in env_cfg:
        cfg["overpass"]["batch_km"] = env_cfg["batch_km"]
    if "map_zoom_start" in env_cfg:
        cfg["map"]["zoom_start"] = env_cfg["map_zoom_start"]
    if "overpass_retries" in env_cfg:
        cfg["overpass"]["retries"] = env_cfg["overpass_retries"]
    if "timezone" in env_cfg:
        cfg["project"]["timezone"] = env_cfg["timezone"]
    
    return cfg


def load_and_merge_config(config_path: str, args) -> dict:
    """
    Load YAML configuration, merge env vars, then merge CLI overrides into it.
    Precedence (highest to lowest): CLI args > env vars > YAML defaults
    """
    cfg = load_yaml_config(config_path)
    # Ensure optional search filters exist
    cfg.setdefault("search", {})
    cfg["search"].setdefault("include", [])
    cfg["search"].setdefault("exclude", [])
    
    # Apply environment variables first
    env_cfg = load_env_config()
    cfg = merge_env_into_config(cfg, env_cfg)
    
    # Apply CLI overrides last
    cfg = merge_cli_into_config(cfg, args)
    
    return cfg
