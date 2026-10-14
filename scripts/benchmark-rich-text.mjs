// Install fixed candidates in an isolated directory; no runtime dependency changes:
// npm install --prefix /tmp/rich-text-parser-evaluation --ignore-scripts htmlparser2@12.0.0 parse5@7.2.1 esbuild@0.20.2
// node scripts/benchmark-rich-text.mjs /tmp/rich-text-parser-evaluation
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { performance } from 'node:perf_hooks'
const toolRoot = resolve(process.argv[2] || '/tmp/rich-text-parser-evaluation')
const req = createRequire(resolve(toolRoot, 'package.json'))
const { build } = req('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = mkdtempSync(resolve(tmpdir(), 'rich-text-benchmark-'))
const cases = {
  article: '<h2>标题</h2><p>正文<strong>强调</strong>&copy; &#x1f600;</p>'.repeat(500),
  manyNodes: '<p><span>A</span><a href="/x">B</a></p>'.repeat(1000),
  deep: '<div>'.repeat(100) + '正文' + '</div>'.repeat(100),
  malformed: '<ul><li>A<li>B</ul><table><tr><td>1<td>2</table><p>one<div>two</div>three'
}
const results = []
const parsers = {}
for (const [name, contents] of Object.entries({
  current: `export {parseHtml as parse} from ${JSON.stringify(resolve(root, 'src/uni_modules/wot-ui/components/wd-rich-text/parser.ts'))}`,
  htmlparser2: `export {parseDocument as parse} from ${JSON.stringify('htmlparser2')}`,
  parse5: `export {parseFragment as parse} from ${JSON.stringify('parse5')}`
})) {
  const file = resolve(output, name + '.mjs')
  await build({
    stdin: { contents, resolveDir: toolRoot, sourcefile: name + '.js' },
    outfile: file,
    bundle: true,
    minify: true,
    platform: 'neutral',
    format: 'esm',
    target: 'es2017'
  })
  const bytes = readFileSync(file)
  const { parse } = await import(pathToFileURL(file).href)
  parsers[name] = parse
  const timings = {}
  for (const [key, html] of Object.entries(cases)) {
    for (let i = 0; i < 10; i++) parse(html)
    const samples = []
    for (let i = 0; i < 40; i++) {
      const start = performance.now()
      parse(html)
      samples.push(performance.now() - start)
    }
    samples.sort((a, b) => a - b)
    timings[key] = { codeUnits: html.length, medianMs: +samples[20].toFixed(3), p95Ms: +samples[38].toFixed(3) }
  }
  results.push({ name, bundleBytes: bytes.length, gzipBytes: gzipSync(bytes).length, timings })
}
// Structural comparison uses generated fragments, not captured editor documents.
function canonical(nodes) {
  const result = []
  for (const node of nodes) {
    const name = node.name || node.tagName
    if (node.type === 'text' || node.nodeName === '#text') {
      const value = node.text ?? node.data ?? node.value
      if (typeof result.at(-1) === 'string') result[result.length - 1] += value
      else result.push(value)
    } else if (name) {
      const aliases = { b: 'strong', i: 'em' }
      const children = canonical(node.children || node.childNodes || [])
      if (name === 'tbody') result.push(...children)
      else result.push({ name: aliases[name] || name, children })
    }
  }
  return result
}
const recoveryCases = {
  list: '<ul><li>A<li>B</ul>',
  table: '<table>outside<tr><td>A</table>',
  formatting: '<p><b>one<i>two</b>three</i></p>',
  entity: '<p>&NotEqualTilde; &amp;lt;</p>',
  editorLike: '<p class="ql-align-center"><strong>Title</strong></p><ol><li>First</li></ol>'
}
const recovery = Object.fromEntries(
  Object.entries(recoveryCases).map(([name, html]) => {
    const trees = Object.fromEntries(
      Object.entries(parsers).map(([key, parse]) => {
        const parsed = parse(html)
        return [key, canonical(Array.isArray(parsed) ? parsed : parsed.children || parsed.childNodes)]
      })
    )
    return [
      name,
      {
        html,
        currentMatchesParse5: JSON.stringify(trees.current) === JSON.stringify(trees.parse5),
        htmlparser2MatchesParse5: JSON.stringify(trees.htmlparser2) === JSON.stringify(trees.parse5),
        trees
      }
    ]
  })
)
console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      note: 'Host parser microbenchmark only. Current also filters content and enforces limits; other candidates do not. These are not equivalent full rendering pipelines or device measurements. Size excludes Vue and rendering. Recovery comparison normalizes b/i and implicit tbody only.',
      versions: { htmlparser2: '12.0.0', parse5: '7.2.1' },
      results,
      recovery
    },
    null,
    2
  )
)
