import { getPlainText } from './parser'
import { layoutTable } from './table'
import { RichTextParseError, richTextLimits } from './limits'
import { getStyleValue } from './style'
import type { NativeRichTextNode, RichTextInputNode, RichTextRenderNode, RichTextHeading } from './types'

const blockTags = new Set([
  'div',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'blockquote',
  'pre',
  'hr',
  'dl',
  'dt',
  'dd',
  'figure',
  'figcaption',
  'caption'
])
const defaultStyles: Record<string, string> = {
  div: 'display:block;',
  mark: 'display:inline;background-color:yellow;color:black;',
  small: 'display:inline;font-size:0.8em;',
  ins: 'display:inline;text-decoration:underline;',
  dl: 'display:block;margin:0 0 12px;',
  dt: 'display:block;font-weight:bold;',
  dd: 'display:block;margin:0 0 8px 24px;',
  figure: 'display:block;margin:0 0 12px;',
  figcaption: 'display:block;text-align:center;font-size:0.9em;',
  caption: 'display:table-caption;text-align:center;',
  p: 'display:block;margin:0 0 12px;',
  h1: 'display:block;font-size:2em;font-weight:bold;margin:0 0 0.6em;',
  h2: 'display:block;font-size:1.5em;font-weight:bold;margin:0 0 0.6em;',
  h3: 'display:block;font-size:1.17em;font-weight:bold;margin:0 0 0.6em;',
  h4: 'display:block;font-size:1em;font-weight:bold;margin:0 0 0.6em;',
  h5: 'display:block;font-size:0.83em;font-weight:bold;margin:0 0 0.6em;',
  h6: 'display:block;font-size:0.67em;font-weight:bold;margin:0 0 0.6em;',
  u: 'display:inline;text-decoration:underline;',
  s: 'display:inline;text-decoration:line-through;',
  sub: 'display:inline;vertical-align:sub;font-size:smaller;',
  sup: 'display:inline;vertical-align:super;font-size:smaller;',
  blockquote: 'display:block;margin:0 0 12px;padding-left:12px;border-left:3px solid var(--wot-border-main);',
  pre: 'display:block;white-space:pre-wrap;font-family:monospace;margin:0 0 12px;',
  code: 'display:inline;font-family:monospace;',
  hr: 'display:block;border:0;border-top:1px solid var(--wot-border-main);margin:12px 0;',
  br: '',
  span: 'display:inline;',
  strong: 'display:inline;font-weight:bold;',
  em: 'display:inline;font-style:italic;',
  a: 'display:inline;color:var(--wot-rich-text-link-color,var(--wot-primary-6));text-decoration:underline;',
  img: 'max-width:100%;vertical-align:middle;',
  ul: 'display:block;padding-left:24px;margin:0 0 12px;list-style-type:disc;',
  ol: 'display:block;padding-left:24px;margin:0 0 12px;list-style-type:decimal;',
  li: 'display:list-item;',
  table: 'display:table;border-collapse:collapse;width:100%;',
  tbody: 'display:table-row-group;',
  thead: 'display:table-header-group;',
  tfoot: 'display:table-footer-group;',
  tr: 'display:table-row;',
  td: 'display:table-cell;padding:8px;border:1px solid var(--wot-border-main);vertical-align:middle;',
  th: 'display:table-cell;padding:8px;border:1px solid var(--wot-border-main);font-weight:bold;'
}

/** 展开列表后手动保留起始序号，不依赖跨组件 CSS counter。 */
function listMarker(value: number, type: string): string {
  if (type === 'none') return ''
  if (['disc', 'circle', 'square'].includes(type)) return ({ disc: '•', circle: '◦', square: '▪' } as Record<string, string>)[type] + '\u00a0'
  let marker = String(value)
  if (type.includes('alpha') && value > 0) {
    marker = ''
    for (let i = value; i > 0; i = Math.floor((i - 1) / 26)) marker = String.fromCharCode(97 + ((i - 1) % 26)) + marker
  } else if (type.includes('roman') && value > 0 && value < 4000) {
    marker = ''
    let remaining = value
    const numbers = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
    const letters = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i']
    numbers.forEach((number, index) => {
      while (remaining >= number) {
        marker += letters[index]
        remaining -= number
      }
    })
  }
  return (type.startsWith('upper-') ? marker.toUpperCase() : marker) + '.\u00a0'
}

/** 将清洗后的节点编译为混合渲染树，仅展开需要交互的子树。 */
export function compileRichText(input: RichTextInputNode[], enableAnchor = false) {
  const interactive = new WeakMap<RichTextInputNode, boolean>()
  const images: string[] = []
  const previewImages: string[] = []
  const headings: RichTextHeading[] = []
  const anchorIds = new WeakMap<RichTextInputNode, string>()
  if (enableAnchor) {
    const reserved = new Set<string>()
    const used = new Set<string>()
    const collect = (nodes: RichTextInputNode[]) =>
      nodes.forEach((node) => {
        if (node.type !== 'element') return
        if (node.attrs?.id) reserved.add(node.attrs.id)
        if (!['video', 'audio'].includes(node.name)) collect(node.children || [])
      })
    collect(input)
    let headingIndex = 0
    const index = (nodes: RichTextInputNode[]) =>
      nodes.forEach((node) => {
        if (node.type !== 'element' || node.name === 'source') return
        let id = node.attrs?.id || ''
        if (used.has(id)) id = '' // 重复的显式 ID 由第一个节点占用。
        if (/^h[1-6]$/.test(node.name)) {
          if (!id) {
            do {
              id = `heading-${++headingIndex}`
            } while (reserved.has(id) || used.has(id))
          }
          headings.push({ id, level: Number(node.name[1]), text: getPlainText(node.children || []).trim() })
        }
        if (id) {
          used.add(id)
          anchorIds.set(node, id)
        }
        if (!['video', 'audio'].includes(node.name)) index(node.children || [])
      })
    index(input)
  }
  let sequence = 0
  const nextId = () => `rt-${sequence++}`
  const styleOf = (node: Extract<RichTextInputNode, { type: 'element' }>) => {
    const dimensions = ['width', 'height']
      .map((key) => {
        const value = node.attrs?.[key]
        return value ? `${key}:${/^\d+(?:\.\d+)?$/.test(value) ? value + 'px' : value};` : ''
      })
      .join('')
    const listStyle =
      node.name === 'ol'
        ? `list-style-type:${
            ({ '1': 'decimal', a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman' } as Record<string, string>)[
              node.attrs?.type || '1'
            ] || 'decimal'
          };`
        : ''
    return (defaultStyles[node.name] || '') + listStyle + dimensions + (node.attrs?.style || '')
  }

  function mark(node: RichTextInputNode): boolean {
    // 所有子节点都须访问，不能用 some 的短路跳过后续子树。
    const childFlags = node.type === 'element' ? (node.children || []).map(mark) : []
    const result =
      node.type === 'element' &&
      (anchorIds.has(node) ||
        node.name === 'a' ||
        node.name === 'img' ||
        node.name === 'table' ||
        node.name === 'video' ||
        node.name === 'audio' ||
        childFlags.some(Boolean))
    interactive.set(node, result)
    return result
  }
  input.forEach(mark)

  function toNative(node: RichTextInputNode): NativeRichTextNode {
    // 原生 rich-text 会再次解码实体；转义 & 保持与 text 渲染路径相同的字面文本。
    if (node.type === 'text') return { type: 'text', text: node.text.replace(/&/g, '&amp;') }
    const name = ['pre', 'figure', 'figcaption', 'caption'].includes(node.name)
      ? 'div'
      : ['u', 's', 'mark', 'small'].includes(node.name)
      ? 'span'
      : node.name
    const attrs: Record<string, string> = { ...node.attrs, style: styleOf(node) }
    delete attrs.id
    return { name, attrs, children: (node.children || []).map(toNative) }
  }

  function visit(nodes: RichTextInputNode[], allowBlocks: boolean): RichTextRenderNode[] {
    const result: RichTextRenderNode[] = []
    let batch: NativeRichTextNode[] = []
    function flush() {
      if (!batch.length) return
      result.push({ id: nextId(), kind: 'static', name: 'div', style: '', children: [], nativeNodes: batch })
      batch = []
    }
    for (const node of nodes) {
      const block = node.type === 'element' && blockTags.has(node.name) && !getStyleValue(node.attrs?.style || '', 'display')?.startsWith('inline')
      if (allowBlocks && block && !interactive.get(node)) {
        batch.push(toNative(node))
        continue
      }
      // HTML 格式化产生的块间空白不打断静态分组。
      if (batch.length && node.type === 'text' && /^\s*$/.test(node.text)) {
        batch.push(toNative(node))
        continue
      }
      flush()
      const base: RichTextRenderNode = { id: nextId(), kind: 'text', name: 'span', style: '', children: [] }
      if (node.type === 'text') {
        result.push({ ...base, text: node.text })
        continue
      }
      base.anchorId = anchorIds.get(node)
      base.name = node.name
      base.style = styleOf(node)
      if (node.name === 'img') {
        base.kind = 'image'
        base.alt = node.attrs?.alt || ''
        base.style = 'display:inline-block;width:100%;' + base.style
        const height = getStyleValue(base.style, 'height')
        base.fixedHeight = !!height && height.toLowerCase() !== 'auto'
        base.imageStyle = base.fixedHeight ? 'height:100%;' : 'height:auto;'
        base.src = node.attrs?.src || ''
        base.imageIndex = images.length
        images.push(base.src)
        base.previewSrc = node.attrs?.['data-preview'] === 'false' ? '' : node.attrs?.['original-src'] || base.src
        previewImages.push(base.previewSrc)
      } else if (node.name === 'video' || node.name === 'audio') {
        base.kind = 'media'
        base.mediaType = node.name
        const height = getStyleValue(base.style, 'height')
        base.fixedHeight = !!height && height.toLowerCase() !== 'auto'
        base.sources = [
          node.attrs?.src || '',
          ...(node.children || []).flatMap((child) => (child.type === 'element' && child.name === 'source' ? [child.attrs?.src || ''] : []))
        ].filter(Boolean)
        base.poster = node.attrs?.poster
        base.alt = node.attrs?.title || (node.name === 'video' ? 'Video' : 'Audio')
        base.loop = node.attrs?.loop === 'true'
        base.muted = node.attrs?.muted === 'true'
        base.style = 'display:block;width:100%;' + base.style
      } else if (node.name === 'table') {
        base.kind = 'table'
        if (!(node.children || []).some((child) => interactive.get(child))) base.nativeNodes = [toNative(node)]
        else {
          const layout = layoutTable(node)
          if (layout.merged) {
            base.tableStyle = base.style + `;display:grid;grid-template-columns:repeat(${layout.columns},minmax(0,1fr));`
            base.children = layout.captions.map((caption, index) => {
              const rendered = visit([caption], false)[0]
              rendered.style += `;display:block;grid-column:1 / -1;grid-row:${index + 1};`
              return rendered
            })
            for (const cell of layout.cells) {
              const rendered = visit([cell.node], false)[0]
              rendered.style =
                cell.inheritedStyle +
                rendered.style +
                `;display:block;min-width:0;grid-row:${cell.row} / span ${cell.rowSpan};grid-column:${cell.column} / span ${cell.colSpan};`
              base.children.push(rendered)
            }
          } else base.children = visit(node.children || [], false)
        }
      } else {
        base.kind = node.name === 'a' ? 'link' : 'element'
        base.href = node.attrs?.href || ''
        base.children = visit(node.children || [], ['div', 'li', 'td', 'th', 'dd', 'figure', 'figcaption'].includes(node.name))
        if (node.name === 'ol' || node.name === 'ul') {
          let number = Number(node.attrs?.start || 1)
          const type = getStyleValue(base.style, 'list-style-type') || (node.name === 'ol' ? 'decimal' : 'disc')
          for (const child of base.children) {
            if (child.name !== 'li') continue
            child.marker = listMarker(number++, type)
            child.style += ';display:block;list-style-type:none;'
          }
        }
      }
      result.push(base)
    }
    flush()
    return result
  }
  const result = { nodes: visit(input, true), images, previewImages, headings }
  if (JSON.stringify(result).length > richTextLimits.output)
    throw new RichTextParseError('OUTPUT_LIMIT', 'Rendered node data exceeds 2000000 characters')
  return result
}
