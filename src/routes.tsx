import type { RouteObject } from 'react-router-dom'
import App from './App'
import Intro from './pages/Intro'
import Compose from './pages/Compose'
import Review from './pages/Review'
import Listen from './pages/Listen'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Consent from './pages/Consent'
import Order from './pages/Order'

/**
 * Маршруты вынесены отдельно, потому что их используют два входа:
 * main.tsx в браузере и entry-prerender.tsx при сборке. Дублировать
 * конфигурацию нельзя — разъедется.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Intro /> },
      { path: 'compose', element: <Compose /> },
      { path: 'review', element: <Review /> },
      { path: 'listen', element: <Listen /> },
      { path: 'order/:token', element: <Order /> },
      { path: 'privacy', element: <Privacy /> },
      { path: 'terms', element: <Terms /> },
      { path: 'consent', element: <Consent /> },
    ],
  },
]
