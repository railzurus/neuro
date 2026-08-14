import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { routes } from './routes'

const router = createBrowserRouter(routes)

/*
  createRoot, а не hydrateRoot. Предрендерена только главная, а index.html
  для остальных маршрутов не отдаётся (SPA-фолбэк указывает на app.html,
  см. public/.htaccess), но полагаться на точное совпадение разметки всё
  равно не хочется: расхождение при гидрации React встречает ошибкой.
  Здесь он просто заменяет содержимое — это происходит мгновенно.
*/
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
