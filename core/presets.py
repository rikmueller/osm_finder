import yaml


def load_presets(path: str) -> dict:
    """
    Load presets.yaml and return a dictionary.
    """
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("presets", {})


def validate_filter_syntax(filter_str: str):
    """
    Validate that a filter has the form key=value.
    """
    if "=" not in filter_str:
        raise ValueError(f"Invalid filter (expected key=value): {filter_str}")
    key, value = filter_str.split("=", 1)
    key = key.strip()
    value = value.strip()
    if not key or not value:
        raise ValueError(f"Invalid filter (empty key or value): {filter_str}")
    return key, value


def apply_presets_to_filters(
    presets: dict,
    base_include: list,
    base_exclude: list,
    preset_names: list | None,
    cli_include: list | None,
    cli_exclude: list | None,
):
    """
    Combine:
    - Base filters from config.yaml (only if no CLI args provided)
    - Presets from presets.yaml
    - Additional CLI filters
    and validate the syntax.
    """
    # Only use base filters if NO CLI arguments are provided (check for None, not truthiness)
    if preset_names is not None or cli_include is not None or cli_exclude is not None:
        include = []
        exclude = []
    else:
        include = list(base_include or [])
        exclude = list(base_exclude or [])

    # Apply presets
    if preset_names:
        for name in preset_names:
            if name not in presets:
                raise ValueError(f"Preset '{name}' not found in presets.yaml.")
            p = presets[name]
            include.extend(p.get("include", []))
            exclude.extend(p.get("exclude", []))

    # Add CLI filters
    if cli_include:
        include.extend(cli_include)
    if cli_exclude:
        exclude.extend(cli_exclude)

    # Remove duplicates
    include = list(dict.fromkeys(include))
    exclude = list(dict.fromkeys(exclude))

    # Validierung
    for f in include + exclude:
        validate_filter_syntax(f)

    return include, exclude
