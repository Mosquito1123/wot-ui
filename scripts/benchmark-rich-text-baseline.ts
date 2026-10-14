/** pnpm exec esno scripts/benchmark-rich-text-baseline.ts；合成样本，不代表设备性能。 */
import { performance } from 'node:perf_hooks'
import { parseHtml } from '../src/uni_modules/wot-ui/components/wd-rich-text/parser'
import { compileRichText } from '../src/uni_modules/wot-ui/components/wd-rich-text/transform'
import type { RichTextRenderNode } from '../src/uni_modules/wot-ui/components/wd-rich-text/types'

const samples = {
  article: '<h2>章节</h2><p>正文<strong>强调</strong>&copy; &#x1f600;</p>'.repeat(100),
  longArticle: '<p>一段用于测量静态内容合并的正文。</p>'.repeat(1000),
  images: '<p>图片说明</p><img width="320" height="200" src="https://example.com/image.jpg">'.repeat(100),
  table: '<table><tr><th colspan="2">标题</th></tr><tr><td>A</td><td><a href="/detail">详情</a></td></tr></table>'.repeat(50),
  editorPatterns:
    '<h2>说明</h2><p class="ql-align-center">居中</p><p class="ql-indent-2">缩进</p><figure><img src="/sample.jpg"><figcaption>图注</figcaption></figure>'.repeat(
      50
    )
}
const count = (nodes: RichTextRenderNode[]): number => nodes.reduce((sum, node) => sum + 1 + count(node.children), 0)
const results = []
for (const [name, html] of Object.entries(samples)) {
  for (const enableAnchor of [false, true]) {
    const run = () => compileRichText(parseHtml(html, { enableAnchor }), enableAnchor)
    for (let i = 0; i < 10; i++) run()
    const timings = Array.from({ length: 30 }, () => {
      const start = performance.now()
      run()
      return performance.now() - start
    }).sort((a, b) => a - b)
    const output = run()
    results.push({
      sample: name,
      enableAnchor,
      inputCodeUnits: html.length,
      outputCodeUnits: JSON.stringify(output).length,
      renderNodes: count(output.nodes),
      medianMs: +timings[15].toFixed(2),
      p95Ms: +timings[28].toFixed(2)
    })
  }
}
console.log(
  JSON.stringify(
    {
      runtime: process.version,
      platform: process.platform,
      arch: process.arch,
      note: 'Synthetic host baseline; excludes UI rendering, network and device performance.',
      results
    },
    null,
    2
  )
)
