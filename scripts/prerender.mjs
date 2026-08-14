/**
 * Предрендер страниц с самостоятельным содержанием.
 *
 * Запускается после обеих сборок (см. npm run build):
 *   dist/index.html — шаблон от vite build
 *   dist-ssr/       — серверная сборка entry-prerender.tsx
 *
 * На выходе:
 *   dist/index.html   — главная с готовой разметкой внутри #root
 *   dist/privacy.html — и так далее по одному файлу на страницу
 *   dist/app.html     — тот же шаблон с пустым #root
 *
 * Зачем app.html. index.html отдаётся Apache только по адресу «/», а на все
 * прочие маршруты SPA-фолбэк подставляет app.html (см. public/.htaccess).
 * Если бы фолбэк отдавал предрендеренный index.html, человек, открывший
 * ссылку на заказ из письма, сначала увидел бы главную страницу и только
 * потом свой заказ.
 *
 * Список страниц берётся из dist/sitemap.xml, а не задаётся здесь: иначе
 * карта сайта и предрендер разъезжаются, и робот приходит по карте на
 * страницу, которая для него пустая. Добавили страницу в карту — она
 * предрендерится сама.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dist = path.join(process.cwd(), 'dist')
const indexPath = path.join(dist, 'index.html')
const entryPath = path.join(process.cwd(), 'dist-ssr', 'entry-prerender.js')

const ROOT_MARKER = '<div id="root"></div>'

const template = await readFile(indexPath, 'utf8')
if (!template.includes(ROOT_MARKER)) {
  throw new Error(
    `В dist/index.html не найден ${ROOT_MARKER} — некуда вставлять разметку. ` +
      'Проверьте index.html в корне проекта.',
  )
}

// Шаблон с пустым корнем — для всех маршрутов, кроме предрендеренных.
await writeFile(path.join(dist, 'app.html'), template, 'utf8')

const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8')
const routes = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(
  (m) => new URL(m[1]).pathname,
)

if (routes.length === 0) {
  throw new Error('В dist/sitemap.xml не найдено ни одного <loc> — нечего предрендерить')
}

const { render } = await import(pathToFileURL(entryPath).href)

for (const route of routes) {
  const html = await render(route)
  if (!html.trim()) {
    throw new Error(`Предрендер вернул пустую разметку для ${route}`)
  }

  // «/» ложится в index.html, остальные — рядом файлом: /privacy → privacy.html.
  // Не каталогом с index.html внутри: Apache редиректил бы /privacy на /privacy/.
  const file = route === '/' ? 'index.html' : route.replace(/^\/|\/$/g, '') + '.html'

  await writeFile(
    path.join(dist, file),
    template.replace(ROOT_MARKER, `<div id="root">${html}</div>`),
    'utf8',
  )
  console.log(`prerender: ${route} → ${file}, ${html.length} символов`)
}

console.log(`prerender: готово, страниц ${routes.length}, app.html создан`)
