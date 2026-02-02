import './BrandingHeader.css'

type Props = {
  title: string
  subtitle?: string
  onHelpClick?: () => void
}

export default function BrandingHeader({ title, subtitle, onHelpClick }: Props) {
  return (
    <header className="branding-header">
      <div className="branding-group">
        <div className="branding-glass">
          <div className="branding-text">
            <div className="branding-title">{title}</div>
            {subtitle && <div className="branding-subtitle">{subtitle}</div>}
          </div>
        </div>
        <button
          className="branding-help-button"
          type="button"
          onClick={onHelpClick}
          aria-label="Open help"
          title="Quickstart help"
          disabled={!onHelpClick}
        >
          ?
        </button>
      </div>
    </header>
  )
}
