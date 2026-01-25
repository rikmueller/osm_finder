#!/usr/bin/env python3
"""
Flask web application for AlongGPX.
Provides REST API endpoints for GPX processing.
"""

import os
import sys
import logging
import tempfile
import threading
import uuid
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_file

from cli.main import run_pipeline
from core.config import load_yaml_config, load_env_config, merge_env_into_config
from core.presets import load_presets

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Flask app initialization
# Note: This module is now under backend/ instead of docker/
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
app.config['UPLOAD_FOLDER'] = tempfile.gettempdir()
app.config['JSON_SORT_KEYS'] = False

ALLOWED_EXTENSIONS = {'gpx'}

# Job tracking system (thread-safe dict)
job_registry = {}
job_registry_lock = threading.Lock()


def create_job(project_name: str):
    """Create a new job tracking entry."""
    job_id = str(uuid.uuid4())
    with job_registry_lock:
        job_registry[job_id] = {
            'id': job_id,
            'state': 'queued',  # queued, processing, completed, failed
            'percent': 0,
            'message': 'Queued for processing',
            'project_name': project_name,
            'created_at': datetime.now().isoformat(),
            'excel_file': None,
            'html_file': None,
            'rows_count': None,
            'track_length_km': None,
            'error': None,
        }
    return job_id


def update_job(job_id: str, **kwargs):
    """Update job status."""
    with job_registry_lock:
        if job_id in job_registry:
            job_registry[job_id].update(kwargs)


def get_job(job_id: str):
    """Get job status."""
    with job_registry_lock:
        return job_registry.get(job_id, None)


def process_gpx_async(job_id: str, config: dict, temp_gpx_path: str, form_presets, form_includes, form_excludes):
    """Run pipeline in background thread."""
    try:
        update_job(job_id, state='processing', percent=10, message='Starting pipeline...')
        result = run_pipeline(
            config,
            cli_presets=form_presets,
            cli_include=form_includes,
            cli_exclude=form_excludes,
        )
        try:
            os.remove(temp_gpx_path)
        except Exception as e:
            logger.warning(f"Could not delete temp GPX: {e}")
        update_job(
            job_id,
            state='completed',
            percent=100,
            message='Processing complete',
            excel_file=os.path.basename(result['excel_path']),
            html_file=os.path.basename(result['html_path']),
            rows_count=result['rows_count'],
            track_length_km=result['track_length_km'],
        )
    except Exception as e:
        logger.error(f"Processing failed for job {job_id}: {e}", exc_info=True)
        update_job(
            job_id,
            state='failed',
            percent=0,
            message='Processing failed',
            error=str(e),
        )


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'AlongGPX'}), 200


@app.route('/api/config', methods=['GET'])
def get_config():
    try:
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'config.yaml')
        config = load_yaml_config(config_path)
        presets_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'presets.yaml')
        presets = load_presets(presets_path)
        return jsonify({
            'defaults': {
                'project_name': config['project']['name'],
                'radius_km': config['search']['radius_km'],
                'step_km': config['search']['step_km'],
                'include': config['search'].get('include', []),
                'exclude': config['search'].get('exclude', []),
            },
            'presets': list(presets.keys()),
            'presets_detail': {name: p for name, p in presets.items()},
        }), 200
    except Exception as e:
        logger.error(f"Config fetch failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/status/<job_id>', methods=['GET'])
def get_status(job_id: str):
    try:
        job = get_job(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        return jsonify(job), 200
    except Exception as e:
        logger.error(f"Status fetch failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/process', methods=['POST'])
def process_gpx():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        if not allowed_file(file.filename):
            return jsonify({'error': 'Only .gpx files allowed'}), 400
        filename = secure_filename(file.filename)
        temp_gpx_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(temp_gpx_path)
        logger.info(f"Processing GPX: {temp_gpx_path}")
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'config.yaml')
        config = load_yaml_config(config_path)
        env_cfg = load_env_config()
        config = merge_env_into_config(config, env_cfg)
        # Ensure optional search filters exist even if omitted in YAML
        config.setdefault('search', {})
        config['search'].setdefault('include', [])
        config['search'].setdefault('exclude', [])
        if 'project_name' in request.form:
            config['project']['name'] = request.form['project_name']
        else:
            config['project']['name'] = os.path.splitext(filename)[0]
        if 'radius_km' in request.form:
            config['search']['radius_km'] = float(request.form['radius_km'])
        if 'step_km' in request.form:
            config['search']['step_km'] = float(request.form['step_km'])
        form_presets = request.form.getlist('preset') if 'preset' in request.form else None
        form_includes = request.form.getlist('include') if 'include' in request.form else None
        form_excludes = request.form.getlist('exclude') if 'exclude' in request.form else None
        if config['search']['step_km'] is None:
            config['search']['step_km'] = config['search']['radius_km'] * 0.6
        config['input']['gpx_file'] = temp_gpx_path
        os.makedirs(config['project']['output_path'], exist_ok=True)
        job_id = create_job(config['project']['name'])
        thread = threading.Thread(
            target=process_gpx_async,
            args=(job_id, config, temp_gpx_path, form_presets, form_includes, form_excludes),
            daemon=True,
        )
        thread.start()
        return jsonify({'job_id': job_id, 'status_url': f'/api/status/{job_id}'}), 202
    except Exception as e:
        logger.error(f"Processing failed: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/download/excel/<filename>', methods=['GET'])
def download_excel(filename):
    try:
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'config.yaml')
        cfg = load_yaml_config(config_path)
        env_cfg = load_env_config()
        cfg = merge_env_into_config(cfg, env_cfg)
        output_dir = os.path.abspath(cfg['project']['output_path'])
        file_path = os.path.join(output_dir, secure_filename(filename))
        logger.info(f"Download Excel requested: {file_path}")
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        return send_file(file_path, as_attachment=True, download_name=filename)
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/download/html/<filename>', methods=['GET'])
def download_html(filename):
    try:
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'config.yaml')
        cfg = load_yaml_config(config_path)
        env_cfg = load_env_config()
        cfg = merge_env_into_config(cfg, env_cfg)
        output_dir = os.path.abspath(cfg['project']['output_path'])
        file_path = os.path.join(output_dir, secure_filename(filename))
        logger.info(f"Download HTML requested: {file_path}")
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        return send_file(file_path, as_attachment=False, download_name=filename)
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large (max 50MB)'}), 413


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('FLASK_PORT', 5000)),
        debug=os.getenv('FLASK_ENV') == 'development'
    )
