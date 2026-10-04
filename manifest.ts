/**
 * App identity contract (handbook §5). The launcher reads this at build time.
 * `appId` and `routePrefix` are frozen after integration-owner sign-off - rename the app instead.
 */
export interface AppManifest {
  appId: string; // stable kebab-case ID, used in URLs, audit logs, feature flags
  name: string; // human label in the launcher grid
  description: string; // tile hover tooltip
  routePrefix: string; // path the app owns
  icon: string; // Lucide icon name
  permissions: string[]; // must match the Permission enum in @quikit/shared - do not invent strings
  navigation: { label: string; href: string; icon: string }[]; // sidebar entries, ordered
}

export const manifest: AppManifest = {
  appId: 'finova',
  name: 'Finova',
  description: 'Double-entry accounting: chart of accounts, journal, and financial reports.',
  // Each QuikIT app is served from its own host at the root (e.g. scale.quikit.ai), so no sub-path prefix.
  routePrefix: '/',
  icon: 'BookOpen',
  // Left empty on purpose: permission strings come from a curated set in @quikit/shared, which is not
  // available here. The integration owner fills this in.
  permissions: [],
  navigation: [
    { label: 'Home', href: '/', icon: 'Home' },
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Accounts', href: '/accounts', icon: 'BookOpen' },
    { label: 'Journal', href: '/journal', icon: 'FileText' },
    { label: 'Reports', href: '/reports', icon: 'BarChart3' },
  ],
};
