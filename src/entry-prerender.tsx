import { renderToString } from 'react-dom/server'
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from 'react-router-dom/server'
import { routes } from './routes'

/**
 * Точка входа для предрендера. Собирается отдельной сборкой (vite build --ssr)
 * и запускается в Node из scripts/prerender.mjs.
 *
 * Здесь нет ни window, ни document: эффекты при renderToString не выполняются,
 * поэтому обращения к localStorage и fetch внутри useEffect не сработают —
 * и не должны. В разметку попадает первый кадр приложения.
 */
export async function render(url: string): Promise<string> {
  const handler = createStaticHandler(routes)
  const context = await handler.query(new Request('http://localhost' + url))

  // query() возвращает Response, если маршрут ответил редиректом. У нас таких
  // нет, но молча отрендерить пустоту хуже, чем упасть на сборке.
  if (context instanceof Response) {
    throw new Error(`Маршрут ${url} ответил редиректом (${context.status})`)
  }

  const router = createStaticRouter(routes, context)
  return renderToString(<StaticRouterProvider router={router} context={context} />)
}
