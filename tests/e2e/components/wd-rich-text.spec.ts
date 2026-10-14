import { test, expect } from '../fixtures/test'
import type { Page } from '@playwright/test'

test.skip(process.env.E2E_SERVER === 'preview', '回归入口仅开发构建提供，生产预览由 wd-rich-text-demo.spec.ts 验证。')

async function openRegression(page: Page, selector: string) {
  await page.goto('/#/subPages/richText/Index?__rich_text_regression=1')
  await expect(page.locator(selector).first()).toBeVisible()
}

test('静态块合并、行内链接不额外换行、事件只触发一次', async ({ page }, testInfo) => {
  await openRegression(page, '.page-rich-text__inline')
  await expect(page.locator('.page-rich-text__static .wd-rich-text__static')).toHaveCount(1)
  await expect(page.locator('.page-rich-text__long .wd-rich-text__static')).toHaveCount(1)
  const paragraph = page.locator('.page-rich-text__inline .wd-rich-text__p').first()
  const rects = await paragraph
    .locator(':scope > .wd-rich-text__text, :scope > .wd-rich-text__link')
    .evaluateAll((elements) =>
      elements.map((el) => ({ top: el.getBoundingClientRect().top, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }))
    )
  expect(rects).toHaveLength(3)
  expect(Math.max(...rects.map((r) => r.top)) - Math.min(...rects.map((r) => r.top))).toBeLessThan(3)
  expect(rects[1].left).toBeGreaterThanOrEqual(rects[0].right - 1)
  expect(rects[2].left).toBeGreaterThanOrEqual(rects[1].right - 1)
  const wrappedLink = page.locator('.page-rich-text__inline .wd-rich-text__p').nth(1).locator('.wd-rich-text__link')
  expect(await wrappedLink.evaluate((el) => el.getClientRects().length)).toBeGreaterThan(1)
  await testInfo.attach('inline-layout', { body: await page.locator('.page-rich-text__inline').screenshot(), contentType: 'image/png' })
  await paragraph.locator('.wd-rich-text__link').click()
  await expect(page.locator('.page-rich-text__events')).toContainText('链接 1；图片 0；/pages/detail')
  expect(page.url()).toContain('/subPages/richText/Index')
})

test('图片链接与表格交互、宽表格滚动不撑开页面', async ({ page }) => {
  await openRegression(page, '.page-rich-text__images')
  await expect(page.locator('.page-rich-text__images .wd-rich-text__image-state')).toHaveCount(0)
  await page.locator('.page-rich-text__images .wd-rich-text__image-box').first().click()
  await expect(page.locator('.page-rich-text__events')).toContainText('链接 0；图片 1；0: /static/icon/app.png')
  await page.locator('.page-rich-text__images .wd-rich-text__image-box').nth(1).click()
  await expect(page.locator('.page-rich-text__events')).toContainText('链接 1；图片 1；/pages/image-detail')
  const scroll = page.locator('.page-rich-text__table .wd-rich-text__scroll')
  await scroll.scrollIntoViewIfNeeded()
  const widths = await scroll.evaluate((el) => ({
    client: el.clientWidth,
    scroll: el.scrollWidth,
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth
  }))
  expect(widths.scroll).toBeGreaterThanOrEqual(600)
  expect(widths.page).toBeLessThanOrEqual(widths.viewport + 1)
  await scroll.evaluate((el) => {
    el.scrollLeft = el.scrollWidth
  })
  await page.locator('.page-rich-text__table .wd-rich-text__link').click()
  await expect(page.locator('.page-rich-text__events')).toContainText('链接 2；图片 1；/pages/detail')
})

test('内容替换清空、多实例保留、主题继承及验证截图', async ({ page }, testInfo) => {
  await openRegression(page, '.page-rich-text__dynamic')
  await page.getByText('替换', { exact: true }).click()
  await expect(page.locator('.page-rich-text__dynamic .wd-rich-text__image-box')).toHaveCount(0)
  await page.getByText('清空', { exact: true }).click()
  await expect(page.locator('.page-rich-text__dynamic')).toHaveText('空内容')
  await expect(page.locator('.page-rich-text__images .wd-rich-text__image-box')).toHaveCount(2)
  const themed = page.locator('.page-rich-text__theme .wd-rich-text').first()
  const before = await themed.evaluate((el) => getComputedStyle(el).color)
  await page.getByText('切换局部主题', { exact: true }).click()
  await expect.poll(() => themed.evaluate((el) => getComputedStyle(el).color)).not.toBe(before)
  await expect(page.locator('.page-rich-text__theme .wd-rich-text__static p').first()).toHaveCSS(
    'color',
    await themed.evaluate((el) => getComputedStyle(el).color)
  )
  await testInfo.attach('rich-text-render-spike', { body: await page.locator('.page-rich-text__theme').screenshot(), contentType: 'image/png' })
})

test('原生与交互路径保留格式、Unicode 和字面实体', async ({ page }) => {
  await openRegression(page, '.page-rich-text__normalization')
  const native = page.locator('.page-rich-text__normalization')
  const expanded = page.locator('.page-rich-text__normalization-interactive')
  for (const root of [native, expanded]) {
    await expect(root).toContainText('下划线、删除线、©、&NotEqualTilde;、😀、&lt;')
  }
  await expect(native.locator('span').filter({ hasText: /^下划线$/ })).toHaveCSS('text-decoration-line', 'underline')
  await expect(expanded.locator('.wd-rich-text__u')).toHaveCSS('text-decoration-line', 'underline')
  await expect(native.locator('code')).toHaveText(' A\n  B', { useInnerText: false })
  await expect(expanded.locator('.wd-rich-text__code')).toContainText(' A\n  B', { useInnerText: false })
  await expect(native.locator('code')).toHaveCSS('white-space', 'pre-wrap')
  await expect(expanded.locator('.wd-rich-text__code .wd-rich-text__text').first()).toHaveCSS('white-space', 'pre-wrap')
})

test('有序列表起始编号、样式映射和交互合并表格布局', async ({ page }) => {
  await openRegression(page, '.page-rich-text__expanded-tags')
  const items = page.locator('.page-rich-text__expanded-tags .wd-rich-text__marker')
  await expect(items).toHaveText(['C.\u00a0', 'D.\u00a0'])
  const paragraph = page.locator('.page-rich-text__style-map p')
  await expect(paragraph).toHaveCSS('text-align', 'center')
  await expect(paragraph).toHaveCSS('font-weight', '700')
  const table = page.locator('.page-rich-text__merged-table .wd-rich-text__table')
  await expect(table).toHaveCSS('display', 'grid')
  await table.scrollIntoViewIfNeeded()
  const cells = await table.locator(':scope > .wd-rich-text__element').evaluateAll((elements) =>
    elements.map((element) => {
      const r = element.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
  )
  expect(cells).toHaveLength(5)
  expect(Math.abs(cells[1].y - cells[2].y)).toBeLessThan(2)
  expect(cells[1].height).toBeGreaterThan(cells[2].height)
  expect(Math.abs(cells[2].width - cells[3].width - cells[4].width)).toBeLessThan(2)
  expect(cells[3].y).toBeGreaterThan(cells[2].y)
  await table.locator('.wd-rich-text__link').click()
  await expect(page.locator('.page-rich-text__events')).toContainText('链接 1；图片 0；/pages/detail')
})

test('视频真实加载错误转为占位', async ({ page }) => {
  await page.route('**/VID_115503.mp4', (route) => route.fulfill({ status: 200, contentType: 'video/mp4', body: 'invalid-video-fixture' }))
  await openRegression(page, '.page-rich-text__expanded-tags')
  await page.getByText('加载视频', { exact: true }).click()
  await expect(page.locator('.wd-rich-text__media-error')).toContainText('示例视频')
})

test('容器内锚点定位不滚动页面，多实例 ID 不冲突', async ({ page }) => {
  await openRegression(page, '.page-rich-text__anchor-regression')
  const area = page.locator('.page-rich-text__anchor-regression')
  await area.getByText('定位容器第二节', { exact: true }).scrollIntoViewIfNeeded()
  const pageTop = await page.evaluate(() => window.scrollY)
  await area.getByText('定位容器第二节', { exact: true }).click()
  const container = page.locator('#rich-text-regression-scroll')
  const target = container.locator('.wd-rich-text__h2').nth(1)
  await expect.poll(async () => Math.abs((await target.boundingBox())!.y - (await container.boundingBox())!.y)).toBeLessThan(3)
  expect(await page.evaluate(() => window.scrollY)).toBe(pageTop)
  const ids = await area.locator('.wd-rich-text__h2').evaluateAll((elements) => elements.map((element) => element.id))
  expect(new Set(ids).size).toBe(4)
})
