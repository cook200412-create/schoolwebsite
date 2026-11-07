import type { Response } from 'express';
import PDFDocument from 'pdfkit';

const NAVY = '#0c2552';
const GOLD = '#b98f17';

export function startPdf(res: Response, filename: string, schoolName: string, title: string) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  doc.pipe(res);
  doc.rect(0, 0, doc.page.width, 90).fill(NAVY);
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text(schoolName, 50, 28, { align: 'center' });
  doc.fontSize(11).fillColor('#f4de8c').text(title.toUpperCase(), { align: 'center', characterSpacing: 2 });
  doc.fillColor('#111827').font('Helvetica').fontSize(11);
  doc.y = 115;
  return doc;
}

export function kv(doc: PDFKit.PDFDocument, pairs: [string, string][]) {
  for (const [k, v] of pairs) {
    doc.font('Helvetica-Bold').text(`${k}: `, { continued: true }).font('Helvetica').text(v ?? '');
  }
  doc.moveDown(0.5);
}

export function table(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], widths: number[]) {
  const x0 = 50;
  let y = doc.y + 6;
  const drawRow = (cells: string[], bold = false, fill?: string) => {
    if (fill) doc.rect(x0, y - 3, widths.reduce((a, b) => a + b, 0), 20).fill(fill).fillColor('#111827');
    let x = x0;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
    cells.forEach((c, i) => { doc.text(c, x + 4, y, { width: widths[i] - 8, lineBreak: false }); x += widths[i]; });
    y += 20;
  };
  drawRow(headers, true, '#e0f2fe');
  rows.forEach((r) => { if (y > 760) { doc.addPage(); y = 60; } drawRow(r); });
  doc.y = y + 8;
  doc.x = x0;
}

export const accent = GOLD;
