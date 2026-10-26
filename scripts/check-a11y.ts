/**
 * Varredura de acessibilidade no código: todo elemento interativo nativo precisa ser anunciado pelo leitor de tela.
 *
 *   - Pressable, TouchableOpacity, TouchableHighlight, TouchableWithoutFeedback e Switch: papel
 *     (accessibilityRole ou role) E rótulo explícito (accessibilityLabel ou aria-label);
 *   - TextInput: rótulo explícito (o papel de campo de texto já é do próprio componente).
 *
 * Fica de fora só o que está escondido do leitor de tela de propósito (accessible={false},
 * accessibilityElementsHidden ou importantForAccessibility "no"/"no-hide-descendants").
 * Lê os .tsx de src/ com o compilador do TypeScript (sem executar nada). Complementa o docs/acessibilidade.md, que
 * lista o que só se confere no aparelho (TalkBack, ordem de foco, fonte ampliada).
 *
 * Uso: npm run check:a11y
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const SRC = join(__dirname, '..', 'src');
const PRECISA_PAPEL_E_ROTULO = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'Switch']);
const PRECISA_ROTULO = new Set(['TextInput']);
const PAPEL = ['accessibilityRole', 'role'];
const ROTULO = ['accessibilityLabel', 'aria-label', 'accessibilityLabelledBy', 'aria-labelledby'];

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return caminho.endsWith('.tsx') ? [caminho] : [];
  });
}

/** Valor literal de um atributo JSX (string ou expressão simples), ou undefined se não for literal. */
function literal(atributo: ts.JsxAttribute): string | boolean | undefined {
  const inicial = atributo.initializer;
  if (!inicial) return true;
  if (ts.isStringLiteral(inicial)) return inicial.text;
  if (ts.isJsxExpression(inicial) && inicial.expression) {
    const e = inicial.expression;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (e.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (e.kind === ts.SyntaxKind.TrueKeyword) return true;
  }
  return undefined;
}

const problemas: string[] = [];
let analisados = 0;

for (const arquivo of arquivos(SRC)) {
  const fonte = ts.createSourceFile(arquivo, readFileSync(arquivo, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visitar = (no: ts.Node) => {
    if (ts.isJsxOpeningElement(no) || ts.isJsxSelfClosingElement(no)) {
      const nome = no.tagName.getText(fonte);
      if (PRECISA_PAPEL_E_ROTULO.has(nome) || PRECISA_ROTULO.has(nome)) {
        analisados += 1;
        const atributos = new Map<string, ts.JsxAttribute>();
        for (const a of no.attributes.properties) {
          if (ts.isJsxAttribute(a)) atributos.set(a.name.getText(fonte), a);
        }
        const valor = (n: string) => (atributos.has(n) ? literal(atributos.get(n)!) : undefined);
        const escondido = valor('accessible') === false
          || valor('accessibilityElementsHidden') === true
          || ['no', 'no-hide-descendants'].includes(String(valor('importantForAccessibility')));
        if (!escondido) {
          const linha = fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;
          const onde = `${relative(join(SRC, '..'), arquivo).replace(/\\/g, '/')}:${linha} <${nome}>`;
          if (!ROTULO.some((r) => atributos.has(r))) problemas.push(`${onde} sem rótulo acessível (accessibilityLabel)`);
          if (PRECISA_PAPEL_E_ROTULO.has(nome) && !PAPEL.some((p) => atributos.has(p))) {
            problemas.push(`${onde} sem papel acessível (accessibilityRole)`);
          }
        }
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
}

if (problemas.length) {
  console.error(`${problemas.length} problema(s) de acessibilidade:\n- ${problemas.join('\n- ')}`);
  process.exit(1);
}
console.log(`OK: ${analisados} elementos interativos com rótulo e papel acessíveis`);
