import { Link, Outlet, type RouteObject } from 'react-router';

import { CurrentTeammateProvider, TeammateSwitcher } from './teammates/current-teammate.tsx';
import { SettingsPage } from './settings/settings-page.tsx';
import { InboxPage } from './tickets/inbox-page.tsx';
import { TicketDetailPage } from './tickets/ticket-detail-page.tsx';

function Layout() {
  return (
    <CurrentTeammateProvider>
      <header className="app-header">
        <Link to="/" className="brand">
          Front Desk
        </Link>
        <div className="header-actions">
          <Link to="/settings">Settings</Link>
          <TeammateSwitcher />
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </CurrentTeammateProvider>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <InboxPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'tickets/:ticketId', element: <TicketDetailPage /> },
    ],
  },
];
