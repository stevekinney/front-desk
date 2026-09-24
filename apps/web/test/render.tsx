import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { routes } from '../src/app.tsx';

/** Render the whole app at a URL. */
export function renderApp(url: string) {
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  return { router, ...render(<RouterProvider router={router} />) };
}
