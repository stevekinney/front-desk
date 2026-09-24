import { Link, Outlet, type RouteObject } from 'react-router';

import { CurrentTeammateProvider, TeammateSwitcher } from './teammates/current-teammate.tsx';
import { InboxPage } from './tickets/inbox-page.tsx';
import { TicketDetailPage } from './tickets/ticket-detail-page.tsx';

function Layout() {
  return (
    <CurrentTeammateProvider>
      <header className="app-header">
        <Link to="/" className="brand">
          Front Desk
        </Link>
        <TeammateSwitcher />
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
      { path: 'tickets/:ticketId', element: <TicketDetailPage /> },
    ],
  },
];
