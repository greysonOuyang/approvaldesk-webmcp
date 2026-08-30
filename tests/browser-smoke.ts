import { chromium } from 'playwright'
import { createServer } from 'vite'

const port = 41731
const log = (message: string) => console.log(`[smoke] ${message}`)
const server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true } })
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

try {
  log('starting vite')
  await server.listen()
  log('vite ready')
  browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 10_000 })
  log('chrome launched')
  const page = await browser.newPage()
  page.setDefaultTimeout(5_000)
  page.on('pageerror', (error) => console.error('[pageerror]', error.message))
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 10_000 })
  log('page loaded')

  await page.getByRole('heading', { name: 'Move fast. Keep the human decision.' }).waitFor()
  await page.getByText('Expense reimbursement', { exact: true }).first().waitFor()
  await page.getByText('Needs approval', { exact: true }).waitFor()
  log('initial UI verified')

  await page.getByRole('button', { name: 'Agent tool console' }).click()
  await page.locator('.console-panel select').first().selectOption('submit_draft')
  await page.getByRole('button', { name: 'Run structured tool' }).click()
  await page.getByText(/HUMAN_APPROVAL_REQUIRED/).waitFor()
  log('early submit rejected')

  await page.getByRole('button', { name: 'Human queue' }).click()
  await page.getByRole('button', { name: 'Approve' }).click()
  await page.getByText('Approved', { exact: true }).waitFor()
  log('human approval recorded')

  await page.getByRole('button', { name: 'Agent tool console' }).click()
  await page.locator('.console-panel select').first().selectOption('submit_draft')
  await page.getByRole('button', { name: 'Run structured tool' }).click()
  await page.getByText(/"status": "submitted"/).waitFor()
  log('approved submit succeeded')

  await page.getByRole('button', { name: 'Audit trail' }).click()
  await page.getByText('submitted', { exact: true }).first().waitFor()
  log('audit verified')
  console.log('BROWSER_SMOKE_OK')
} catch (error) {
  console.error('BROWSER_SMOKE_FAILED', error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  await server.close().catch(() => {})
  log('resources closed')
}

process.exit(process.exitCode ?? 0)
