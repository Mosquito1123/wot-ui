import { getStyleValue } from './style'
import type { RichTextInputNode } from './types'
import { RichTextParseError, richTextLimits } from './limits'

type ElementNode = Extract<RichTextInputNode, { type: 'element' }>
export interface RichTextTableCell {
  node: ElementNode
  row: number
  column: number
  rowSpan: number
  colSpan: number
  inheritedStyle: string
}

/** 将合并单元格转换为有限大小的网格坐标，保留行组边界，避免跨度覆盖后续单元格。 */
export function layoutTable(table: ElementNode) {
  const groups: ElementNode[][] = []
  const groupStyles = new WeakMap<ElementNode, string>()
  const captions: ElementNode[] = []
  let directRows: ElementNode[] = []
  const flush = () => {
    if (directRows.length) groups.push(directRows)
    directRows = []
  }
  for (const node of table.children || []) {
    if (node.type !== 'element') continue
    if (node.name === 'tr') directRows.push(node)
    else if (['thead', 'tbody', 'tfoot'].includes(node.name)) {
      flush()
      const rows = (node.children || []).filter((child): child is ElementNode => child.type === 'element' && child.name === 'tr')
      rows.forEach((row) => groupStyles.set(row, node.attrs?.style || ''))
      groups.push(rows)
    } else if (node.name === 'caption') captions.push(node)
  }
  flush()
  const cells: RichTextTableCell[] = []
  const occupied = new Set<string>()
  let rowOffset = captions.length
  let columns = 1
  let merged = false
  for (const rows of groups) {
    rows.forEach((row, index) => {
      let column = 1
      const rowNumber = rowOffset + index + 1
      for (const node of row.children || []) {
        if (node.type !== 'element' || !['td', 'th'].includes(node.name)) continue
        const colSpan = Number(node.attrs?.colspan || 1)
        const rowSpan = Math.min(Number(node.attrs?.rowspan || 1), rows.length - index)
        merged ||= colSpan > 1 || rowSpan > 1
        // 需要整段连续空位，不仅检查起始格，避免重叠的 rowspan/colspan。
        while (Array.from({ length: colSpan }, (_, offset) => occupied.has(`${rowNumber}:${column + offset}`)).some(Boolean)) column++
        for (let y = rowNumber; y < rowNumber + rowSpan; y++) {
          for (let x = column; x < column + colSpan; x++) {
            occupied.add(`${y}:${x}`)
            if (occupied.size > richTextLimits.nodes) throw new RichTextParseError('OUTPUT_LIMIT', 'Table layout exceeds 10000 occupied cells')
          }
        }
        const rowStyle = (groupStyles.get(row) || '') + (row.attrs?.style || '')
        const inheritedStyle = [
          'color',
          'background-color',
          'font-size',
          'font-family',
          'font-weight',
          'font-style',
          'line-height',
          'letter-spacing',
          'text-align',
          'white-space',
          'word-break',
          'overflow-wrap',
          'text-decoration'
        ]
          .map((property) => {
            const value = getStyleValue(rowStyle, property)
            return value ? `${property}:${value};` : ''
          })
          .join('')
        cells.push({ node, row: rowNumber, column, rowSpan, colSpan, inheritedStyle })
        columns = Math.max(columns, column + colSpan - 1)
        column += colSpan
      }
    })
    rowOffset += rows.length
  }
  return { cells, columns, captions, merged }
}
