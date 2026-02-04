import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './BrandingHeader.css'

type Props = {
  title: string
  subtitle?: string
  showMenu?: boolean
}

export default function BrandingHeader({
  title,
  subtitle,
  showMenu = false,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  return (
    <header className="branding-header">
      <div className="branding-group">
        <div className="branding-glass">
          {showMenu && (
            <div className="branding-menu-wrapper" ref={menuRef}>
              <button
                className="branding-menu-button-inline"
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Open menu"
                title="Menu"
              >
                ☰
              </button>
              {menuOpen && (
                <div className="branding-menu-dropdown">
                  <Link to="/map" className={`branding-menu-item ${location.pathname === '/map' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                    Map
                  </Link>
                  <Link to="/home" className={`branding-menu-item ${location.pathname === '/home' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                    Home
                  </Link>
                  <Link to="/how-it-works" className={`branding-menu-item ${location.pathname === '/how-it-works' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                    How it works
                  </Link>
                  <Link to="/about" className={`branding-menu-item ${location.pathname === '/about' ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                    About
                  </Link>
                </div>
              )}
            </div>
          )}
          <div className="branding-text">
            <div className="branding-title">{title}</div>
            {subtitle && <div className="branding-subtitle">{subtitle}</div>}
          </div>
        </div>
      </div>
    </header>
  )
}
