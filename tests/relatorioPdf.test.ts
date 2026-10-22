import { describe, expect, it } from '@jest/globals';
import { demoPdfBytes } from '../src/adapters/mock/demoPdf';
import { addMonthsKey, pdfDownloadFailure, pdfFileName, pdfPeriod } from '../src/lib/pdfReport';

describe('período do PDF (conferido antes de chamar o servidor)', () => {
  it('aceita exatamente 12 meses e recusa 12 meses + 1 dia', () => {
    expect(pdfPeriod('10/01/2025', '10/01/2026')).toEqual({ from: '2025-01-10', to: '2026-01-10', error: null });
    expect(pdfPeriod('10/01/2025', '11/01/2026')).toEqual({
      error: 'O período pode ter no máximo 12 meses. Escolha uma data de fim até 10/01/2026.',
    });
  });

  it('recusa formato inválido e início depois do fim', () => {
    expect(pdfPeriod('10/13/2025', '10/01/2026').error).toBe('Use datas no formato DD/MM/AAAA.');
    expect(pdfPeriod('10/01/2026', '09/01/2026').error).toBe('A data de início não pode ser depois da data de fim.');
    expect(pdfPeriod('10/01/2026', '10/01/2026').error).toBeNull();
  });

  it('soma meses como o servidor (fim de mês ajustado)', () => {
    expect(addMonthsKey('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonthsKey('2024-02-29', 12)).toBe('2025-02-28');
    expect(addMonthsKey('2025-11-15', 2)).toBe('2026-01-15');
  });
});

describe('falhas ao baixar o PDF', () => {
  it('cada erro tem uma mensagem clara', () => {
    expect(pdfDownloadFailure({ kind: 'HTTP', status: 422, code: 'PERIODO_SEM_REGISTROS' })).toMatch(/Não há doses registradas/);
    expect(pdfDownloadFailure({ kind: 'NETWORK', status: 0 })).toMatch(/Sem conexão/);
    expect(pdfDownloadFailure({ kind: 'HTTP', status: 401, code: 'SESSAO_INVALIDA' })).toMatch(/sessão terminou/);
    expect(pdfDownloadFailure({ kind: 'HTTP', status: 400, code: 'VALIDACAO', message: 'O período pode ter no máximo 12 meses.' }))
      .toBe('O período pode ter no máximo 12 meses.');
    expect(pdfDownloadFailure({ kind: 'HTTP', status: 404 })).toMatch(/Paciente não encontrado/);
    expect(pdfDownloadFailure({ kind: 'HTTP', status: 500 })).toMatch(/Tente de novo/);
  });
});

describe('arquivo', () => {
  it('nome sem dado pessoal, igual ao do servidor', () => {
    expect(pdfFileName(12, '2026-10-01', '2026-10-18')).toBe('historico-adesao-12-2026-10-01-a-2026-10-18.pdf');
  });

  it('PDF de demonstração é um PDF válido marcado como demonstração', () => {
    const texto = String.fromCharCode(...demoPdfBytes('Histórico (exemplo)'));
    expect(texto.startsWith('%PDF-1.4')).toBe(true);
    expect(texto).toContain('DEMONSTRACAO');
    expect(texto.trimEnd().endsWith('%%EOF')).toBe(true);
    // A tabela xref aponta para o início de cada objeto
    const xref = Number(/startxref\n(\d+)/.exec(texto)?.[1]);
    expect(texto.slice(xref, xref + 4)).toBe('xref');
    const primeiro = Number(/\n(\d{10}) 00000 n /.exec(texto)?.[1]);
    expect(texto.slice(primeiro, primeiro + 7)).toBe('1 0 obj');
  });
});
