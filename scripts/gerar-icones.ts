/**
 * Gera os ícones e a imagem da splash a partir de SVG, com as cores do tema (src/theme/colors.ts), e confere a área
 * segura do ícone adaptativo e o contraste. Reprodutível e sem dependência nativa (resvg em WebAssembly).
 *
 * Uso: npm run gerar:icones   (grava em assets/ e falha se alguma conferência não passar)
 *
 * Desenho original: uma cápsula de remédio inclinada, metade branca e metade azul-clara, com um "+" pequeno de cuidado.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { contrastRatio } from '../src/lib/contrast';
import { palette } from '../src/theme/colors';

const ASSETS = join(__dirname, '..', 'assets');
const LADO = 1024;
const CENTRO = LADO / 2;
/** Ícone adaptativo: tela de 108dp, dos quais só o círculo central de 66dp aparece em qualquer máscara. */
const RAIO_SEGURO = (LADO * 66) / 108 / 2;

/** Cápsula inclinada a -45°, centrada; `escala` 1 = cabe com folga no círculo seguro. */
function capsula(escala: number, metadeA: string, metadeB: string, mais: string, separacao = 0): string {
  const comprimento = 520 * escala;
  const largura = 210 * escala;
  const raio = largura / 2;
  const x = CENTRO - comprimento / 2;
  const y = CENTRO - largura / 2;
  const meio = CENTRO;
  const tamanhoMais = 92 * escala;
  const traco = 26 * escala;
  // O "+" fica no canto livre (acima e à esquerda da cápsula), sobre o fundo, ainda dentro do círculo seguro
  const mx = CENTRO - 175 * escala;
  const my = CENTRO - 175 * escala;
  // Sem separação: a cápsula inteira numa cor e a metade A por cima (evita a linha de serrilhado entre as metades)
  const metades = separacao === 0
    ? `<rect x="${x}" y="${y}" width="${comprimento}" height="${largura}" fill="${metadeB}"/>
      <rect x="${x}" y="${y}" width="${comprimento / 2}" height="${largura}" fill="${metadeA}"/>`
    : `<rect x="${x}" y="${y}" width="${comprimento / 2 - separacao / 2}" height="${largura}" fill="${metadeA}"/>
      <rect x="${meio + separacao / 2}" y="${y}" width="${comprimento / 2}" height="${largura}" fill="${metadeB}"/>`;
  return `
  <g transform="rotate(-45 ${CENTRO} ${CENTRO})">
    <clipPath id="capsula"><rect x="${x}" y="${y}" width="${comprimento}" height="${largura}" rx="${raio}"/></clipPath>
    <g clip-path="url(#capsula)">${metades}</g>
  </g>
  <g fill="${mais}">
    <rect x="${mx - traco / 2}" y="${my - tamanhoMais / 2}" width="${traco}" height="${tamanhoMais}" rx="${traco / 2}"/>
    <rect x="${mx - tamanhoMais / 2}" y="${my - traco / 2}" width="${tamanhoMais}" height="${traco}" rx="${traco / 2}"/>
  </g>`;
}

const svg = (conteudo: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 ${LADO} ${LADO}">${conteudo}</svg>`;

const DESENHOS = {
  /** Ícone principal (lojas, web, Android antigo): quadrado inteiro na cor da marca. */
  'icon.png': svg(`<rect width="${LADO}" height="${LADO}" fill="${palette.primary}"/>${capsula(1.25, palette.white, palette.primarySoft, palette.white)}`),
  /** Ícone adaptativo: primeiro plano transparente, desenho dentro do círculo seguro. */
  'adaptive-icon-foreground.png': svg(capsula(0.95, palette.white, palette.primarySoft, palette.white)),
  /** Ícone adaptativo: fundo. */
  'adaptive-icon-background.png': svg(`<rect width="${LADO}" height="${LADO}" fill="${palette.primary}"/>`),
  /** Ícone monocromático (Android 13+, ícones temáticos): só a silhueta; a separação marca as duas metades. */
  'adaptive-icon-monochrome.png': svg(capsula(0.95, palette.white, palette.white, palette.white, 22)),
  /** Splash: o ícone com cantos arredondados, legível no fundo claro e no escuro. */
  'splash-icon.png': svg(`<rect width="${LADO}" height="${LADO}" rx="${LADO * 0.22}" fill="${palette.primary}"/>${capsula(1.15, palette.white, palette.primarySoft, palette.white)}`),
  'favicon.png': svg(`<rect width="${LADO}" height="${LADO}" rx="${LADO * 0.22}" fill="${palette.primary}"/>${capsula(1.15, palette.white, palette.primarySoft, palette.white)}`),
} as const;

const TAMANHO: Partial<Record<keyof typeof DESENHOS, number>> = { 'favicon.png': 48 };

/** Maior distância do centro de um pixel visível (alfa > 0), em pixels da imagem de 1024. */
function alcance(pixels: Uint8Array): number {
  let maior = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] === 0) continue;
    const p = (i - 3) / 4;
    const dx = (p % LADO) + 0.5 - CENTRO;
    const dy = Math.floor(p / LADO) + 0.5 - CENTRO;
    maior = Math.max(maior, Math.hypot(dx, dy));
  }
  return maior;
}

async function main() {
  await initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
  mkdirSync(ASSETS, { recursive: true });
  const problemas: string[] = [];

  for (const [arquivo, desenho] of Object.entries(DESENHOS) as [keyof typeof DESENHOS, string][]) {
    const imagem = new Resvg(desenho, { fitTo: { mode: 'width', value: TAMANHO[arquivo] ?? LADO } }).render();
    writeFileSync(join(ASSETS, arquivo), imagem.asPng());
    if (arquivo === 'adaptive-icon-foreground.png' || arquivo === 'adaptive-icon-monochrome.png') {
      const r = alcance(imagem.pixels);
      const ok = r <= RAIO_SEGURO;
      console.log(`${ok ? 'ok ' : 'ERRO'} ${arquivo}: desenho até ${r.toFixed(0)} px do centro (círculo seguro: ${RAIO_SEGURO.toFixed(0)} px)`);
      if (!ok) problemas.push(`${arquivo} sai da área segura do ícone adaptativo`);
    } else {
      console.log(`ok  ${arquivo} (${imagem.width}x${imagem.height})`);
    }
  }

  // O símbolo precisa se destacar do fundo: 3:1, o mínimo para elementos gráficos (WCAG 1.4.11)
  for (const [nome, frente] of [['metade branca', palette.white], ['metade azul-clara', palette.primarySoft]] as const) {
    const razao = contrastRatio(frente, palette.primary);
    console.log(`${razao >= 3 ? 'ok ' : 'ERRO'} contraste da ${nome} sobre o azul da marca: ${razao.toFixed(2)}:1`);
    if (razao < 3) problemas.push(`contraste da ${nome} abaixo de 3:1`);
  }

  if (problemas.length) {
    console.error(`\n${problemas.length} problema(s):\n- ${problemas.join('\n- ')}`);
    process.exit(1);
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
