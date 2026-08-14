import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { routes } from './routes'

/*
  Предрендеренные страницы Apache отдаёт файлами: /privacy → /privacy.html
  (см. public/.htaccess). Обычно подмена внутренняя, и в адресной строке
  остаётся чистый /privacy. Но если открыть адрес с расширением напрямую,
  маршрут не найдётся и страница окажется пустой — приводим адрес к чистому
  виду до создания роутера.
*/
if (window.location.pathname.endsWith('.html')) {
  const { pathname, search, hash } = window.location
  const clean =
    pathname === '/index.html' || pathname === '/app.html'
      ? '/'
      : pathname.slice(0, -'.html'.length)
  window.history.replaceState(null, '', clean + search + hash)
}

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
