import { Link } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import SeoMeta from '../components/SeoMeta'
import './MarketingPages.css'

export default function HomePage() {
  return (
    <MarketingLayout>
      <SeoMeta
        title="WhatsAround – Plan smarter nearby"
        description="Discover points of interest near you or along any route. Find restaurants, shops, accommodations, services and attractions using OpenStreetMap data."
        url="https://getwhatsaround.app/"
      />
      <section className="marketing-hero">
        <h1>Plan smarter with nearby insights.</h1>
        <p>
          WhatsAround helps you discover points of interest along any route or around any location.
          Search, filter, and organize results in seconds — then export maps and spreadsheets when you need them.
        </p>
      </section>

      <section className="marketing-container">
        <h2 className="marketing-section-title">Features</h2>
        <p className="marketing-section-subtitle">
          Everything you need to discover and organize points of interest with a clean, fast workflow.
        </p>
        
        <div className="marketing-grid">
          <div className="marketing-card">
            <h3>Flexible input modes</h3>
            <p>Upload GPX tracks or drop a map marker for quick, targeted exploration.</p>
          </div>
          <div className="marketing-card">
            <h3>Preset-powered discovery</h3>
            <p>Start with curated presets or build custom filters using standard OpenStreetMap tags.</p>
          </div>
          <div className="marketing-card">
            <h3>Map-first experience</h3>
            <p>See results on a live map with instant track rendering and real-time progress updates.</p>
          </div>
          <div className="marketing-card">
            <h3>Smart filtering</h3>
            <p>Include and exclude tags to surface exactly the results you care about.</p>
          </div>
          <div className="marketing-card">
            <h3>Export tools</h3>
            <p>Download Excel files and interactive HTML maps for offline use or sharing.</p>
          </div>
        </div>

        <div className="marketing-cta-panel">
          <div>
            <h3>Ready to explore?</h3>
            <p>Open the map and run your first search in minutes.</p>
          </div>
          <Link to="/map" className="marketing-button primary">
            Open Map
          </Link>
        </div>
      </section>
    </MarketingLayout>
  )
}
