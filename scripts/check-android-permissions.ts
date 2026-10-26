/// <reference types="node" />
/**
 * Permissões finais do Android sem deixar android/ no repositório: copia o projeto para uma pasta temporária (com
 * node_modules ligado, não copiado), roda `expo prebuild --platform android --no-install` lá, junta as permissões do
 * manifesto do app com as dos manifestos das bibliotecas em node_modules, tira as marcadas com tools:node="remove" e
 * compara com a lista mínima do app.config.ts. Apaga a pasta temporária no fim.
 *
 * Não substitui o manifesto mesclado pelo Gradle: bibliotecas que vêm só do Maven (Firebase, Play Services, o
 * ShortcutBadger do expo-notifications) não entram aqui. Para conferir o APK de verdade, com o aapt do Android SDK,
 * passe o arquivo: só essas permissões (e a interna do AndroidX, exclusiva do app) podem estar nele.
 *
 * Uso: npm run check:permissions
 *      npm run check:permissions -- --apk caminho/do/app.apk
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { ANDROID_BLOCKED_PERMISSIONS, ANDROID_PERMISSIONS } from '../app.config';

const raiz = join(__dirname, '..');
const IGNORAR = new Set(['node_modules', '.git', 'android', 'ios', '.expo', 'dist', 'dist-check', 'coverage']);

function permissoes(xml: string) {
  const usadas = new Set<string>();
  const removidas = new Set<string>();
  for (const tag of xml.match(/<uses-permission\b[^>]*>/g) ?? []) {
    const nome = /android:name="([^"]+)"/.exec(tag)?.[1];
    if (!nome) continue;
    if (/tools:node="remove"/.test(tag)) removidas.add(nome);
    else usadas.add(nome);
  }
  return { usadas, removidas };
}

/** Manifestos das bibliotecas nativas instaladas (um nível de pacote e escopos @org). */
function manifestosDasBibliotecas(nodeModules: string): string[] {
  const achados: string[] = [];
  const visitar = (dir: string) => {
    const manifesto = join(dir, 'android', 'src', 'main', 'AndroidManifest.xml');
    if (existsSync(manifesto)) achados.push(manifesto);
  };
  for (const nome of readdirSync(nodeModules)) {
    const dir = join(nodeModules, nome);
    if (!statSync(dir).isDirectory()) continue;
    if (nome.startsWith('@')) for (const sub of readdirSync(dir)) visitar(join(dir, sub));
    else visitar(dir);
  }
  return achados;
}

/** aapt da versão mais nova do build-tools do Android SDK (ANDROID_HOME ou o caminho padrão no Windows). */
function aapt(): string {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
  const versoes = existsSync(join(sdk, 'build-tools')) ? readdirSync(join(sdk, 'build-tools')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })) : [];
  for (const versao of versoes) {
    for (const nome of ['aapt.exe', 'aapt']) {
      const caminho = join(sdk, 'build-tools', versao, nome);
      if (existsSync(caminho)) return caminho;
    }
  }
  throw new Error('aapt não encontrado: instale o build-tools do Android SDK ou defina ANDROID_HOME');
}

/** Permissões do APK final (manifesto mesclado pelo Gradle, com tudo o que veio do Maven). */
function verificarApk(apk: string) {
  const saida = execSync(`"${aapt()}" dump permissions "${apk}"`, { encoding: 'utf8' }); // NOSONAR: aapt do Android SDK local
  const pacote = /^package: (\S+)/m.exec(saida)?.[1] ?? '';
  const noApk = [...new Set([...saida.matchAll(/name='([^']+)'/g)].map((m) => m[1]))].sort((a, b) => a.localeCompare(b));
  // Permissão de assinatura que o AndroidX cria só para o próprio app (receptores dinâmicos não exportados)
  const interna = `${pacote}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`;
  console.log(`Permissões no APK ${apk}:`);
  for (const p of noApk) console.log(`  ${p}`);
  const esperadas = [...ANDROID_PERMISSIONS, interna].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(noApk, esperadas, 'o APK tem permissões fora da lista mínima (bloqueie em ANDROID_BLOCKED_PERMISSIONS)');
  console.log(`\nOK: ${noApk.length} permissões no APK, todas da lista mínima`);
}

function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'medcare-prebuild-'));
  try {
    cpSync(raiz, tmp, { recursive: true, filter: (origem) => !IGNORAR.has(relative(raiz, origem).split(sep)[0]) });
    symlinkSync(join(raiz, 'node_modules'), join(tmp, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    // Sem telemetria: o processo que a envia ficaria rodando com a pasta temporária como diretório atual
    // NOSONAR: ferramenta de verificação local, roda o npx do próprio projeto na pasta temporária
    execSync('npx expo prebuild --platform android --no-install', { // NOSONAR
      cwd: tmp,
      stdio: 'ignore',
      env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
    });

    const app = permissoes(readFileSync(join(tmp, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8'));
    const finais = new Set(app.usadas);
    for (const manifesto of manifestosDasBibliotecas(join(raiz, 'node_modules'))) {
      const lib = permissoes(readFileSync(manifesto, 'utf8'));
      for (const p of lib.usadas) {
        if (!app.removidas.has(p)) finais.add(p);
      }
    }

    const lista = [...finais].sort((a, b) => a.localeCompare(b));
    console.log('Permissões finais (manifesto do prebuild + bibliotecas do node_modules):');
    for (const p of lista) console.log(`  ${p}`);
    assert.deepEqual(lista, [...ANDROID_PERMISSIONS].sort((a, b) => a.localeCompare(b)), 'permissões diferentes da lista mínima do app.config.ts');
    for (const bloqueada of ANDROID_BLOCKED_PERMISSIONS) assert.ok(app.removidas.has(bloqueada), `${bloqueada} sem tools:node="remove"`);
    assert.ok(!existsSync(join(raiz, 'android')) && !existsSync(join(raiz, 'ios')), 'android/ ou ios/ no repositório');
    const gitignore = readFileSync(join(raiz, '.gitignore'), 'utf8');
    assert.match(gitignore, /^android\/$/m);
    assert.match(gitignore, /^ios\/$/m);
    console.log(`\nOK: ${lista.length} permissões, ${ANDROID_BLOCKED_PERMISSIONS.length} bloqueadas; android/ e ios/ fora do repositório`);
  } finally {
    // Primeiro só o link do node_modules (sem seguir para o node_modules de verdade), depois a pasta temporária
    const link = join(tmp, 'node_modules');
    if (existsSync(link)) {
      if (process.platform === 'win32') execSync(`cmd /c rmdir "${link}"`, { stdio: 'ignore' });
      else unlinkSync(link);
    }
    // No Windows o rmSync recursivo falha (EPERM) em arquivos que o prebuild deixa: o rmdir do sistema apaga
    if (process.platform === 'win32') execSync(`cmd /c rmdir /s /q "${tmp}"`, { stdio: 'ignore' });
    else rmSync(tmp, { recursive: true, force: true });
    assert.ok(!existsSync(tmp), `pasta temporária não foi apagada: ${tmp}`);
    assert.ok(existsSync(join(raiz, 'node_modules', 'expo')), 'node_modules do projeto foi afetado');
  }
}

const indiceApk = process.argv.indexOf('--apk');
if (indiceApk >= 0) verificarApk(process.argv[indiceApk + 1]);
else main();
