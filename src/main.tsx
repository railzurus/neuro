import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App'
import Intro from './pages/Intro'
import Compose from './pages/Compose'
import Review from './pages/Review'
import Listen from './pages/Listen'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Consent from './pages/Consent'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Intro /> },
      { path: 'compose', element: <Compose /> },
      { path: 'review', element: <Review /> },
      { path: 'listen', element: <Listen /> },
      { path: 'privacy', element: <Privacy /> },
      { path: 'terms', element: <Terms /> },
      { path: 'consent', element: <Consent /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
