/**
 * Предрендер главной страницы.
 *
 * Запускается после обеих сборок (см. npm run build):
 *   dist/index.html — шаблон от vite build
 *   dist-ssr/       — серверная сборка entry-prerender.tsx
 *
 * На выходе:
 *   dist/index.html — главная с готовой разметкой внутри #root
 *   dist/app.html   — тот же шаблон с пустым #root
 *
 * Зачем два файла. index.html отдаётся Apache только по адресу «/», а на все
 * прочие маршруты SPA-фолбэк подставляет app.html (см. public/.htaccess).
 * Если бы фолбэк отдавал предрендеренный index.html, человек, открывший
 * ссылку на заказ из письма, сначала увидел бы главную страницу и только
 * потом свой заказ.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const indexPath = path.join(root, 'dist', 'index.html')
const appPath = path.join(root, 'dist', 'app.html')
const entryPath = path.join(root, 'dist-ssr', 'entry-prerender.js')

const ROOT_MARKER = '<div id="root"></div>'

const template = await readFile(indexPath, 'utf8')
if (!template.includes(ROOT_MARKER)) {
  throw new Error(
    `В dist/index.html не найден ${ROOT_MARKER} — некуда вставлять разметку. ` +
      'Проверьте index.html в корне проекта.',
  )
}

// Шаблон с пустым корнем — для всех маршрутов, кроме главной.
await writeFile(appPath, template, 'utf8')

const { render } = await import(pathToFileURL(entryPath).href)
const html = await render('/')

if (!html.trim()) {
  throw new Error('Предрендер вернул пустую разметку')
}

await writeFile(
  indexPath,
  template.replace(ROOT_MARKER, `<div id="root">${html}</div>`),
  'utf8',
)

console.log(`prerender: главная — ${html.length} символов разметки, app.html создан`)
