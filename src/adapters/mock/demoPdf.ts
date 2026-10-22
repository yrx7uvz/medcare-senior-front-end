/**
 * PDF de demonstração (modo demo, sem servidor): uma página dizendo que é exemplo, sem dado real. PDF 1.4 mínimo e
 * válido, montado em texto (só ASCII, para os deslocamentos da tabela xref baterem com os bytes).
 */
export function demoPdfBytes(title: string): Uint8Array {
  const safe = title.normalize('NFD').replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, '');
  const content = `BT /F1 20 Tf 72 760 Td (DEMONSTRACAO - dados ficticios) Tj 0 -32 Td /F1 12 Tf (${safe}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i);
  return bytes;
}
