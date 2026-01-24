#!/usr/bin/env python3
"""
Flask web application for AlongGPX.
Provides REST API endpoints for GPX processing.
"""

import os
import sys
import logging
import tempfile

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_file

from cli.main import run_pipeline
from core.config import load_yaml_config, load_env_config, merge_env_into_config

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Flask app initialization
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
app.config['UPLOAD_FOLDER'] = tempfile.gettempdir()
app.config['JSON_SORT_KEYS'] = False

ALLOWED_EXTENSIONS = {'gpx'}


def allowed_file(filename: str) -> bool:
    """Check if file has allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'AlongGPX'
    }), 200


@app.route('/api/process', methods=['POST'])
def process_gpx():
    """
    Process a GPX file and return results.
    
    Expects:
    - POST multipart/form-data with:
      - 'file': GPX file
      - 'project_name' (optional): Project name for output
      - 'radius_km' (optional): Search radius in km
      - 'include' (optional): Include filter(s) (comma-separated or repeated)
      - 'exclude' (optional): Exclude filter(s) (comma-separated or repeated)
    
    Returns:
    - JSON with paths to Excel and HTML files
    """
    try:
        # Validate file upload
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Only .gpx files allowed'}), 400
        
        # Save uploaded GPX to temp directory
        filename = secure_filename(file.filename)
        temp_gpx_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(temp_gpx_path)
        
        logger.info(f"Processing GPX: {temp_gpx_path}")
        
        # Load base configuration from parent directory
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.yaml')
        config = load_yaml_config(config_path)
        
        # Apply environment variables
        env_cfg = load_env_config()
        config = merge_env_into_config(config, env_cfg)
        
        # Override with form parameters if provided
        if 'project_name' in request.form:
            config['project']['name'] = request.form['project_name']
        else:
            config['project']['name'] = os.path.splitext(filename)[0]
        
        if 'radius_km' in request.form:
            config['search']['radius_km'] = float(request.form['radius_km'])
        
        if 'step_km' in request.form:
            config['search']['step_km'] = float(request.form['step_km'])
        
        # Extract form filters to pass as CLI args to run_pipeline
        # (this allows proper precedence: form args override config.yaml)
        form_presets = request.form.getlist('preset') if 'preset' in request.form else None
        form_includes = request.form.getlist('include') if 'include' in request.form else None
        form_excludes = request.form.getlist('exclude') if 'exclude' in request.form else None
        
        # Ensure step_km is set (60% of radius_km if not specified)
        if config['search']['step_km'] is None:
            config['search']['step_km'] = config['search']['radius_km'] * 0.6
        
        # Set GPX file path
        config['input']['gpx_file'] = temp_gpx_path
        
        # Ensure output directory exists
        os.makedirs(config['project']['output_path'], exist_ok=True)
        
        # Run pipeline with form overrides as CLI args
        result = run_pipeline(
            config,
            cli_presets=form_presets,
            cli_include=form_includes,
            cli_exclude=form_excludes,
        )
        
        # Clean up temp GPX
        try:
            os.remove(temp_gpx_path)
        except Exception as e:
            logger.warning(f"Could not delete temp GPX: {e}")
        
        return jsonify({
            'success': True,
            'excel_file': os.path.basename(result['excel_path']),
            'html_file': os.path.basename(result['html_path']),
            'excel_path': result['excel_path'],
            'html_path': result['html_path'],
            'rows_count': result['rows_count'],
            'track_length_km': result['track_length_km']
        }), 200
    
    except Exception as e:
        logger.error(f"Processing failed: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/download/excel/<filename>', methods=['GET'])
def download_excel(filename):
    """Download Excel file."""
    try:
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.yaml')
        output_dir = load_yaml_config(config_path)['project']['output_path']
        file_path = os.path.join(output_dir, secure_filename(filename))
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(file_path, as_attachment=True, download_name=filename)
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/download/html/<filename>', methods=['GET'])
def download_html(filename):
    """Download HTML map file."""
    try:
        config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.yaml')
        output_dir = load_yaml_config(config_path)['project']['output_path']
        file_path = os.path.join(output_dir, secure_filename(filename))
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(file_path, as_attachment=True, download_name=filename)
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error."""
    return jsonify({'error': 'File too large (max 50MB)'}), 413


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Only for development! Use gunicorn in production
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('FLASK_PORT', 5000)),
        debug=os.getenv('FLASK_ENV') == 'development'
    )
