import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import './MarketingLayout.css'

type Props = {
  children: ReactNode
  title?: string
  subtitle?: string
}

export default function MarketingLayout({
  children,
  title = 'WhatsAround',
  subtitle = 'Plan smarter nearby',
}: Props) {
  return (
    <div className="marketing-shell">
      <header className="marketing-header">
        <div className="marketing-header-inner">
          <Link to="/home" className="marketing-brand" aria-label="WhatsAround home">
            <div className="marketing-brand-title">{title}</div>
            <div className="marketing-brand-subtitle">{subtitle}</div>
          </Link>

          <nav className="marketing-nav" aria-label="Primary">
            <NavLink to="/how-it-works" className={({ isActive }) => `marketing-link ${isActive ? 'active' : ''}`}>
              How it works
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => `marketing-link ${isActive ? 'active' : ''}`}>
              About
            </NavLink>
          </nav>

          <div className="marketing-cta">
            <Link to="/map" className="marketing-button primary">
              Open Map
            </Link>
          </div>
        </div>
      </header>

      <main className="marketing-main">{children}</main>

      <footer className="marketing-footer">
        <div className="marketing-footer-inner">
          <div>© {new Date().getFullYear()} WhatsAround</div>
          <div className="marketing-footer-links">
            <Link to="/features">Features</Link>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/about">About</Link>
            <Link to="/app">Open App</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
