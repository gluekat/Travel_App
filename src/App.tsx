import type { ReactNode } from 'react';
import { useRoute } from './lib/router';
import { Icon } from './components/ui';
import { OfflineBanner } from './components/OfflineBanner';
import { ClosetPage } from './features/closet/ClosetPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TripsPage } from './features/trips/TripsPage';
import { TripDetail } from './features/trips/TripDetail';
import { PackingPage } from './features/packing/PackingPage';

const NAV = [
  { path: 'closet', label: 'Closet', icon: 'shirt' },
  { path: 'trips', label: 'Trips', icon: 'map' },
  { path: 'settings', label: 'Data & privacy', icon: 'gear' },
] as const;

function Page({ route }: { route: string[] }): ReactNode {
  const [section = 'trips', id, sub] = route;
  if (section === 'closet') return <ClosetPage />;
  if (section === 'settings') return <SettingsPage />;
  if (section === 'trips' && id) {
    const tripId = Number(id);
    return sub === 'packing' ? <PackingPage tripId={tripId} /> : <TripDetail tripId={tripId} />;
  }
  return <TripsPage />;
}

export function App() {
  const route = useRoute();
  const section = route[0] ?? 'trips';
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
          <a href="#/trips" className="flex items-center gap-2 font-semibold text-teal-800">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            PackWise
          </a>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <a
                key={n.path}
                href={`#/${n.path}`}
                aria-current={section === n.path ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium ${
                  section === n.path ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon name={n.icon} />
                <span className="hidden sm:inline">{n.label}</span>
              </a>
            ))}
          </nav>
        </div>
        <OfflineBanner />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">
        <Page route={route} />
      </main>
    </div>
  );
}
