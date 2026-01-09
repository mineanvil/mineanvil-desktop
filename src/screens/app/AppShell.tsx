import type { ReactNode } from 'react'
import type { AppTab, LicenseMode } from '../../ux/flowTypes'

function tabLabel(tab: AppTab): string {
  switch (tab) {
    case 'home':
      return 'HOME'
    case 'worlds':
      return 'WORLDS'
    case 'curatedWorlds':
      return 'CURATED WORLDS'
    case 'seeds':
      return 'SEEDS'
    case 'mods':
      return 'MODS'
  }
}

export function AppShell(props: {
  username?: string
  licenseMode: LicenseMode
  appTab: AppTab
  onSelectTab: (tab: AppTab) => void
  onRefreshStatus: () => void
  onSignOut: () => void
  children: ReactNode
}) {
  const badgeLabel = props.licenseMode === 'demo' ? 'Demo Mode' : 'Ready'
  const badgeClass = props.licenseMode === 'demo' ? 'status-badge status-badge-demo' : 'status-badge status-badge-ready'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-user">
            <span className="app-user-name">{props.username ?? 'Account'}</span>
            <span className={badgeClass}>{badgeLabel}</span>
          </div>
        </div>
        <div className="app-header-actions">
          <button type="button" className="button-secondary button-small" onClick={props.onRefreshStatus}>
            Refresh status
          </button>
          <button type="button" className="button-secondary button-small" onClick={props.onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="tabs-bar" aria-label="Primary tabs">
        {(['home', 'worlds', 'curatedWorlds', 'seeds', 'mods'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab-button ${props.appTab === tab ? 'tab-button-active' : ''}`}
            onClick={() => props.onSelectTab(tab)}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </nav>

      <main className="app-content">{props.children}</main>
    </div>
  )
}


