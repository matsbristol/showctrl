// Reading and saving spreadsheet files in the browser. SheetJS is loaded only when someone
// imports or exports, so it doesn't slow down the rest of the app.

import { parseCsv, toCsv } from '../../lib/peopleSheet'

export const SHEET_ACCEPT = '.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt'

export interface SheetFile {
  /** Sheet names (one for CSV). */
  names: string[]
  rows: (sheet: string) => string[][]
}

/** CSV from Excel on Windows is often not UTF-8: fall back to Windows-1252 (æøå). */
function decode(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf)
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8
}

export async function readSheetFile(file: File): Promise<SheetFile> {
  const buf = await file.arrayBuffer()
  if (/\.(csv|tsv|txt)$/i.test(file.name)) {
    const rows = parseCsv(decode(buf))
    return { names: [file.name], rows: () => rows }
  }
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array', dense: true })
  return {
    names: wb.SheetNames,
    rows: name => XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, raw: false, defval: '', blankrows: false })
      .map(r => r.map(c => String(c ?? ''))),
  }
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** An Excel file. Every cell is text, so phone numbers keep their + and leading zeros. */
export async function saveXlsx(sheets: { name: string; rows: string[][] }[], filename: string) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const width = Math.max(...rows.map(r => r.length))
    ws['!cols'] = Array.from({ length: width }, (_, c) => ({ wch: Math.min(40, Math.max(8, ...rows.map(r => (r[c] ?? '').length))) + 1 }))
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: width - 1 } }) }
    XLSX.utils.book_append_sheet(wb, ws, name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1')
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  save(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}

/** UTF-8 CSV with a byte-order mark, so Excel shows æøå correctly. */
export function saveCsv(rows: string[][], filename: string, sep: string) {
  save(new Blob(['﻿' + toCsv(rows, sep)], { type: 'text/csv;charset=utf-8' }), filename)
}

/** "Nordlys Open Air 2026" → "nordlys-open-air-2026". */
export const fileSlug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export'
