/// <reference types="node" />
/**
 * Deixa o emulador pronto antes do Metro (roda dentro do `npm run emulador`):
 *   1. acha o adb do Android SDK e, se nenhum emulador estiver aberto, abre o AVD (EMULADOR_AVD ou o primeiro da lista)
 *      e espera o Android terminar de iniciar;
 *   2. confere se a build de desenvolvimento do app está instalada;
 *   3. libera a porta 8081: um Metro antigo deste projeto é encerrado (senão o Expo pergunta outra porta e o adb
 *      reverse aponta para a errada); se outro programa estiver nela, para com a explicação;
 *   4. faz o adb reverse do Metro (8081) e da API (porta do EXPO_PUBLIC_API_URL);
 *   5. confere se o backend responde e se é a versão atual (o contrato tem primeiraDose); só avisa, não bloqueia.
 *
 * Uso: npm run emulador (este script e depois o Expo). Sozinho: npx tsx scripts/preparar-emulador.ts
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '..');
const PACOTE = 'br.ucb.medcaresenior';
const METRO = 8081;

const ok = (m: string) => console.log(`ok     ${m}`);
const aviso = (m: string) => console.log(`AVISO  ${m}`);
function falha(m: string): never {
  console.error(`ERRO   ${m}`);
  process.exit(1);
}
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sdk(): string {
  const candidatos = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk')];
  const achado = candidatos.find((c): c is string => !!c && existsSync(join(c, 'platform-tools')));
  if (!achado) falha('Android SDK não encontrado. Instale pelo Android Studio ou defina ANDROID_HOME.');
  return achado;
}

const SDK = sdk();
const ext = process.platform === 'win32' ? '.exe' : '';
const ADB = join(SDK, 'platform-tools', `adb${ext}`);
const EMULATOR = join(SDK, 'emulator', `emulator${ext}`);
const adb = (...args: string[]) => execFileSync(ADB, args, { encoding: 'utf8' }).trim();

const emuladores = () =>
  adb('devices')
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => /\tdevice$/.test(l))
    .map((l) => l.split('\t')[0]);

async function garantirEmulador(): Promise<string> {
  const abertos = emuladores();
  if (abertos.length) {
    ok(`aparelho conectado: ${abertos.join(', ')}`);
    return abertos[0];
  }
  const avds = execFileSync(EMULATOR, ['-list-avds'], { encoding: 'utf8' }).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const avd = process.env.EMULADOR_AVD ?? avds[0];
  if (!avd) falha('Nenhum emulador criado. Crie um no Android Studio (Device Manager).');
  console.log(`...    abrindo o emulador ${avd} (pode levar um ou dois minutos)`);
  spawn(EMULATOR, ['-avd', avd], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 90; i++) {
    await espera(2000);
    const [serial] = emuladores();
    if (serial && execFileSync(ADB, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf8' }).trim() === '1') {
      ok(`emulador ${avd} pronto (${serial})`);
      return serial;
    }
  }
  falha('O emulador não terminou de iniciar em 3 minutos. Abra pelo Android Studio e rode de novo.');
}

/** PID de quem escuta na porta (Windows: netstat; outros: lsof), ou null. */
function donoDaPorta(porta: number): number | null {
  try {
    if (process.platform === 'win32') {
      const linha = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
        .split(/\r?\n/)
        .find((l) => new RegExp(`:${porta}\\s+\\S+\\s+LISTENING`).test(l));
      return linha ? Number(linha.trim().split(/\s+/).pop()) : null;
    }
    const pid = execFileSync('lsof', ['-ti', `tcp:${porta}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n')[0];
    return pid ? Number(pid) : null;
  } catch {
    return null;
  }
}

function linhaDeComando(pid: number): string {
  try {
    if (process.platform === 'win32') {
      return execFileSync('powershell', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`], { encoding: 'utf8' }).trim();
    }
    return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

async function liberarMetro() {
  const pid = donoDaPorta(METRO);
  if (!pid) {
    ok(`porta ${METRO} livre para o Metro`);
    return;
  }
  const comando = linhaDeComando(pid);
  const ehMetroDesteApp = /expo|metro|react-native/i.test(comando) && comando.toLowerCase().includes('medcare-senior-mobile');
  if (!ehMetroDesteApp) {
    falha(`A porta ${METRO} está com outro programa (PID ${pid}: ${comando || 'desconhecido'}). Feche-o e rode de novo.`);
  }
  if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else process.kill(pid);
  for (let i = 0; i < 20 && donoDaPorta(METRO); i++) await espera(250);
  ok(`Metro antigo encerrado (PID ${pid}); porta ${METRO} livre`);
}

/** EXPO_PUBLIC_API_URL do ambiente ou do .env (só essa linha), com o padrão do emulador. */
function apiUrl(): URL {
  let valor = process.env.EXPO_PUBLIC_API_URL;
  const arquivo = join(APP, '.env');
  if (!valor && existsSync(arquivo)) {
    valor = /^EXPO_PUBLIC_API_URL\s*=\s*(.+)$/m.exec(readFileSync(arquivo, 'utf8'))?.[1]?.trim().replace(/^["']|["']$/g, '');
  }
  try {
    return new URL(valor || 'http://10.0.2.2:8080');
  } catch {
    falha(`EXPO_PUBLIC_API_URL inválida: "${valor}". No emulador use http://10.0.2.2:8080.`);
  }
}

async function conferirBackend(url: URL) {
  const porta = url.port || (url.protocol === 'https:' ? '443' : '80');
  const local = ['10.0.2.2', 'localhost', '127.0.0.1'].includes(url.hostname);
  const base = local ? `http://localhost:${porta}` : url.origin;
  const buscar = async (caminho: string) => {
    const r = await fetch(base + caminho, { signal: AbortSignal.timeout(4000) });
    return { status: r.status, texto: await r.text() };
  };
  try {
    const saude = await buscar('/actuator/health');
    if (saude.status !== 200) throw new Error(`status ${saude.status}`);
  } catch {
    aviso(`o backend não respondeu em ${base}. Inicie-o (IntelliJ ou .\\mvnw.cmd spring-boot:run) antes de usar o app.`);
    return;
  }
  try {
    const docs = await buscar('/v3/api-docs');
    if (docs.status === 200 && !docs.texto.includes('primeiraDose')) {
      aviso(`o backend em ${base} está com código antigo (sem a validação de horário). Reinicie-o no IntelliJ.`);
      return;
    }
  } catch {
    // Documentação desligada: não dá para conferir a versão, segue
  }
  ok(`backend no ar em ${base} (o app usa ${url.origin})`);
}

async function main() {
  if (process.env.CI) return;
  const serial = await garantirEmulador();
  const instalado = execFileSync(ADB, ['-s', serial, 'shell', 'pm', 'list', 'packages', PACOTE], { encoding: 'utf8' }).includes(PACOTE);
  if (instalado) ok('build de desenvolvimento do app instalada');
  else aviso(`o app (${PACOTE}) não está instalado neste emulador. Instale a build de desenvolvimento (npm run build:dev ou o APK do EAS).`);

  await liberarMetro();
  const url = apiUrl();
  const portaApi = url.port || '80';
  execFileSync(ADB, ['-s', serial, 'reverse', `tcp:${METRO}`, `tcp:${METRO}`]);
  if (url.protocol === 'http:') execFileSync(ADB, ['-s', serial, 'reverse', `tcp:${portaApi}`, `tcp:${portaApi}`]);
  ok(`adb reverse: Metro ${METRO}${url.protocol === 'http:' ? ` e API ${portaApi}` : ''}`);
  await conferirBackend(url);
  console.log('');
}

void main().catch((e: unknown) => falha(e instanceof Error ? e.message : String(e)));
