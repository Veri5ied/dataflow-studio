import { Link } from '@tanstack/react-router'
import { LogoMark } from './logo-mark'

export default function SiteFooter() {
  return (
    <footer>
      <div className="footer-left">
        <Link to="/" className="nav-brand footer-brand" aria-label="DataFlow Studio home">
          <LogoMark className="nav-logo-mark footer-logo-mark" iconClassName="footer-logo-icon" />
          <span className="footer-copy">DataFlow Studio</span>
        </Link>
        <span className="footer-copy">· TypeScript + Hono + TanStack</span>
      </div>

      <div className="footer-badges">
        <span className="fbadge fbadge-agpl">AGPL-3.0</span>
        <span className="fbadge fbadge-ts">TypeScript</span>
      </div>

      <div className="footer-links">
        <a href="https://github.com/Veri5ied/dataflow-studio" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href="#">Docs</a>
        <a href="#">Changelog</a>
        <a href="#">Security</a>
        <a href="#">Self-hosting</a>
      </div>
    </footer>
  )
}
