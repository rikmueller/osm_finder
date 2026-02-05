import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import MarketingLayout from '../components/MarketingLayout'
import SeoMeta from '../components/SeoMeta'
import './MarketingPages.css'

export default function HowItWorksPage() {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const toggleStep = (stepNumber: number) => {
    setExpandedStep(expandedStep === stepNumber ? null : stepNumber)
  }

  return (
    <MarketingLayout>
      <SeoMeta
        title="How it works | WhatsAround"
        description="See how WhatsAround turns routes into structured insights with filters, live mapping, and export-ready outputs."
        url="https://getwhatsaround.app/how-it-works"
      />

      <section className="marketing-container marketing-hero">
        <h1>How it works.</h1>
        <p>Click any step below to learn more</p>
      </section>

      <section className="marketing-container">
        <div className="marketing-steps">
          
          {/* Step 1 */}
          <div className={`marketing-step expandable ${expandedStep === 1 ? 'expanded' : ''}`} onClick={() => toggleStep(1)}>
            <div className="marketing-step-header">
              <div>
                <span>Step 1</span>
                <h4>Configure project settings</h4>
                <p>Set your basic parameters: project name, search radius and input mode.</p>
              </div>
              <ChevronDown className="expand-icon" />
            </div>
            {expandedStep === 1 && (
              <div className="marketing-step-details">
                <h5>Configure these parameters in the settings panel:</h5>
                <ul>
                  <li><strong>Project Name:</strong> Give your search a meaningful name (used for exported file names)</li>
                  <li><strong>Search Radius:</strong> How far from your track or marker to search for POIs (in km). Typical values: 1-10 km. </li>
                  <p>💡 Larger radius may take longer to process.</p>
                  <li><strong>Input mode:</strong> Choose between uploading a GPX track or setting a map marker.</li>
                </ul>
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div className={`marketing-step expandable ${expandedStep === 2 ? 'expanded' : ''}`} onClick={() => toggleStep(2)}>
            <div className="marketing-step-header">
              <div>
                <span>Step 2</span>
                <h4>Choose your input</h4>
                <p>Upload a GPX route or place a map marker to define where you want to search.</p>
              </div>
              <ChevronDown className="expand-icon" />
            </div>
            {expandedStep === 2 && (
              <div className="marketing-step-details">
                <h5>📂 Uploading GPX Tracks</h5>
                <p>If you already have a GPX track and want to know what is located along the route, select Input Mode GPX Track. </p>
                
                <ul>
                  <li><strong>Drag & Drop:</strong> Drag a GPX file directly onto the upload area</li>
                  <li><strong>File Picker:</strong> Click "Choose File" to select from your device</li>
                  <li><strong>Mobile:</strong> Tap the upload area to access files or cloud storage</li>
                </ul>
                <p>Your track appears immediately on the map for confirmation.</p>
                
                <h5>📍 Using Marker Mode</h5>
                <p>If you prefer to search around a specific point rather than a route, select Input Mode Marker.</p>
                <ul>
                  <li>Switch to <strong>Marker Mode</strong> in settings</li>
                  <li>Click the map to place your search marker</li>
                  <li>Search finds POIs within your radius around that point</li>
                </ul>
                <p><strong>⚠️ Mobile:</strong> Reopen settings panel after placing a marker to adjust filters and start processing.</p>
              </div>
            )}
          </div>

          {/* Step 3 */}
          <div className={`marketing-step expandable ${expandedStep === 3 ? 'expanded' : ''}`} onClick={() => toggleStep(3)}>
            <div className="marketing-step-header">
              <div>
                <span>Step 3</span>
                <h4>Select filters</h4>
                <p>Use presets or add custom include/exclude tags to focus on the POIs that matter to you.</p>
              </div>
              <ChevronDown className="expand-icon" />
            </div>
            {expandedStep === 3 && (
              <div className="marketing-step-details">
                <h5>Define what you are looking for:</h5>
                <ul>
                  <li><strong>Presets:</strong> Pre-configured combinations (camping, accommodation, food, etc.).</li>
                  <p>💡With presets you don´t need to worry about OSM tags.</p>
                  <li><strong>Include filters:</strong> OSM tags to search for (e.g., <code>tourism=camp_site</code>)</li>
                  <li><strong>Exclude filters:</strong> Remove unwanted matches (e.g., <code>tents=no</code>)</li>
                </ul>
                
                <h5>Finding OSM Tags</h5>
                <ul>
                  <li><a href="https://wiki.openstreetmap.org/wiki/Map_features" target="_blank" rel="noopener noreferrer">OSM Map Features Wiki</a> - Official reference</li>
                  <li><a href="https://taginfo.openstreetmap.org/" target="_blank" rel="noopener noreferrer">TagInfo</a> - Tag usage statistics</li>
                </ul>
                <p><strong>Syntax:</strong> <code>key=value</code> (e.g., <code>amenity=drinking_water</code>)</p>
              </div>
            )}
          </div>

          {/* Step 4 */}
          <div className={`marketing-step expandable ${expandedStep === 4 ? 'expanded' : ''}`} onClick={() => toggleStep(4)}>
            <div className="marketing-step-header">
              <div>
                <span>Step 4</span>
                <h4>Run the search</h4>
                <p>Start the search by pressing the Process button. WhatsAround batches Overpass API queries and streams results as they appear in the App.</p>
              </div>
              <ChevronDown className="expand-icon" />
            </div>
            {expandedStep === 4 && (
              <div className="marketing-step-details">
                <h5><strong>Watch your results appear:</strong></h5>
                <ul>
                  <li>Progress bar shows query completion. Queries sometimes take a little time, so please be patient. </li>
                  <li>Results are color-coded by filter match (red = 1st filter, orange = 2nd, etc.)</li>
                </ul>
                
                <h5>Each POI displays:</h5>
                <ul>
                  <li>Name and type (from OSM data)</li>
                  <li>Distance from your track/marker</li>
                  <li>Distance from from track start (when input mode is track))</li>
                  <li>Coordinates and address (when available)</li>
                  <li>All relevant OSM tags</li>
                </ul>
                <p><strong>💡 Tip:</strong> Filter order matters—the first matching include filter determines marker color.</p>
              </div>
            )}
          </div>

          {/* Step 5 */}
          <div className={`marketing-step expandable ${expandedStep === 5 ? 'expanded' : ''}`} onClick={() => toggleStep(5)}>
            <div className="marketing-step-header">
              <div>
                <span>Step 5</span>
                <h4>Export & share</h4>
                <p>Download Excel summaries or interactive HTML maps to share with teams or keep for reference.</p>
              </div>
              <ChevronDown className="expand-icon" />
            </div>
            {expandedStep === 5 && (
              <div className="marketing-step-details">
                <h5>Export Formats</h5>
                <ul>
                  <li><strong>Excel (.xlsx):</strong> Structured data table with all POI details, sortable and filterable</li>
                  <li><strong>Interactive Map (.html):</strong> Standalone Folium map</li>
                </ul>
                
                <h5>💡 Tips & Best Practices</h5>
                <ul>
                  <li>Start with presets for well-tested filter combinations</li>
                  <li>Use exclude filters to refine results (e.g., <code>access=private</code>)</li>
                  <li>Save HTML maps - they work offline and can be shared</li>
                </ul>
                
                <h5>🐛 Troubleshooting</h5>
                <ul>
                  <li><strong>No results?</strong> Check filter syntax and verify OSM data exists</li>
                  <li><strong>Timeout?</strong> Increase batch size or reduce radius</li>
                  <li><strong>Wrong colors?</strong> Reorder your include filters</li>
                </ul>
              </div>
            )}
          </div>

        </div>

        <div className="marketing-cta-panel">
          <div>
            <h3>Ready to try it?</h3>
            <p>Launch the App and start discovering nearby insights in minutes.</p>
          </div>
          <Link to="/app" className="marketing-button primary">
            Open App
          </Link>
        </div>
      </section>
    </MarketingLayout>
  )
}
