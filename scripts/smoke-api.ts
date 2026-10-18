/// <reference types="node" />
/**
 * Teste ponta a ponta REAL contra a API (backend rodando). Cria um cuidador com e-mail aleatório, um idoso, um
 * remédio e um tratamento com dose daqui a ~20 min, pareia o idoso, confirma a dose e por fim exclui a conta (o que
 * apaga tudo o que foi criado). Falha em qualquer passo = código de saída != 0 com o passo.
 *
 * Uso: npm run smoke:api  (EXPO_PUBLIC_API_URL; padrão http://localhost:8080)
 */
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL ??= 'http://localhost:8080';
process.env.EXPO_PUBLIC_DEMO = 'false';

const FUSO = 'America/Sao_Paulo';
const DIAS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

/** Data, hora e dia da semana de um instante no fuso da API. */
function noFuso(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { dia: `${parts.year}-${parts.month}-${parts.day}`, hora: `${parts.hour}:${parts.minute}`, diaSemana: DIAS[weekday] };
}

interface DoseDTO {
  id: number;
  medicamentoId: number;
  horarioProgramado: string;
  status: string;
  statusExibicao: string;
  confirmabilidade: string;
}

async function main() {
  // Importados depois de definir o ambiente: env.ts lê EXPO_PUBLIC_* ao carregar
  const { request, setTokenProvider } = await import('../src/adapters/http/httpClient');
  const { httpAuthService } = await import('../src/adapters/http/HttpAuthService');
  const { fromApiId, toApiId } = await import('../src/adapters/http/ids');
  const { AppError } = await import('../src/services/errors');

  let token: string | null = null;
  setTokenProvider(() => token);

  let passo = '';
  async function step<T>(nome: string, fn: () => Promise<T>): Promise<T> {
    passo = nome;
    const r = await fn();
    console.log(`ok  ${nome}`);
    return r;
  }
  async function expectError(fn: () => Promise<unknown>, status: number, codigo: string) {
    try {
      await fn();
    } catch (e) {
      assert.ok(e instanceof AppError, `esperava AppError, veio ${String(e)}`);
      assert.equal(e.status, status, `status: ${e.status} ${e.code} ${e.message}`);
      assert.equal(e.code, codigo, `codigo: ${e.code} (${e.message})`);
      return `${e.status} ${e.code}`;
    }
    assert.fail(`esperava ${status} ${codigo}, mas a chamada deu certo`);
  }

  const agora = new Date();
  const alvo = noFuso(new Date(agora.getTime() + 20 * 60_000));
  const hoje = noFuso(agora);
  if (alvo.dia !== hoje.dia) {
    throw new Error('Faltam menos de 20 minutos para a meia-noite em São Paulo: rode o smoke depois da virada do dia.');
  }

  const email = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.com`;
  const senha = 'SenhaForte1';
  let contaExcluida = false;

  try {
    const cadastro = await step('1. cadastro do cuidador (POST /api/cuidadores + login)', () =>
      httpAuthService.signUp({ name: 'Cuidador Smoke', email, phone: '11999990000', password: senha, lgpdConsent: true }),
    );
    assert.ok(cadastro.token && cadastro.caregiverId);

    const sessao = await step('2. login (POST /api/auth/login)', () => httpAuthService.login(email, senha));
    assert.equal(sessao.name, 'Cuidador Smoke');
    assert.equal(sessao.caregiverId, cadastro.caregiverId);
    token = sessao.token;

    const idoso = await step('3. cadastro do idoso (POST /api/idosos)', () =>
      request<{ id: number; nome: string }>('POST', '/api/idosos', { nome: 'Idoso Smoke', dataNascimento: '1945-03-12' }),
    );
    const idosoId = fromApiId(idoso.id);

    const medicamento = await step('4. cadastro do remédio (POST /api/medicamentos, COMPRIMIDO)', () =>
      request<{ id: number; tipo: string }>('POST', '/api/medicamentos', {
        nome: 'Losartana',
        dosagem: '50mg',
        tipo: 'COMPRIMIDO',
        idosoId: toApiId(idosoId),
      }),
    );
    assert.equal(medicamento.tipo, 'COMPRIMIDO');

    await step(`5. tratamento hoje às ${alvo.hora} (${alvo.diaSemana}) (POST /api/medicamentos/{id}/tratamentos)`, () =>
      request('POST', `/api/medicamentos/${medicamento.id}/tratamentos`, {
        dataInicio: hoje.dia,
        horarios: [alvo.hora],
        diasSemana: [alvo.diaSemana],
      }),
    );

    const codigo = await step('6. gerar código de vínculo (POST /api/idosos/{id}/gerar-codigo)', () =>
      request<{ codigo: string }>('POST', `/api/idosos/${toApiId(idosoId)}/gerar-codigo`),
    );
    assert.match(codigo.codigo, /^\d{6}$/);

    token = null;
    const pareamento = await step('7. pareamento do idoso (POST /api/vinculo/validar)', () =>
      request<{ token: string; id: number; nome: string }>('POST', '/api/vinculo/validar', { codigo: codigo.codigo }),
    );
    assert.equal(fromApiId(pareamento.id), idosoId);
    assert.equal(pareamento.nome, 'Idoso Smoke');
    const tokenIdoso = pareamento.token;
    token = tokenIdoso;

    const dose = await step('8. GET /api/idosos/me e /api/idosos/me/doses (dose na janela)', async () => {
      const me = await request<{ id: number; nome: string; cuidadorNome: string }>('GET', '/api/idosos/me');
      assert.equal(fromApiId(me.id), idosoId);
      assert.equal(me.cuidadorNome, 'Cuidador Smoke');
      const doses = await request<DoseDTO[]>('GET', '/api/idosos/me/doses');
      const encontrada = doses.find((d) => d.medicamentoId === medicamento.id && d.horarioProgramado.startsWith(`${hoje.dia}T${alvo.hora}`));
      assert.ok(encontrada, `dose de ${alvo.hora} não encontrada em ${JSON.stringify(doses)}`);
      assert.equal(encontrada.confirmabilidade, 'OK');
      return encontrada;
    });

    await step('9. confirmar a dose (PUT /api/doses/{id}/confirmar) -> 200 TOMADA', async () => {
      const confirmada = await request<DoseDTO>('PUT', `/api/doses/${dose.id}/confirmar`);
      assert.equal(confirmada.status, 'TOMADA');
    });

    const segunda = await step('10. confirmar de novo -> 409 DOSE_JA_REGISTRADA', () =>
      expectError(() => request('PUT', `/api/doses/${dose.id}/confirmar`), 409, 'DOSE_JA_REGISTRADA'),
    );
    console.log(`    (${segunda})`);

    token = sessao.token;
    await step('11. cuidador vê a dose TOMADA (GET /api/idosos/{id}/doses)', async () => {
      const doses = await request<DoseDTO[]>('GET', `/api/idosos/${toApiId(idosoId)}/doses`);
      const vista = doses.find((d) => d.id === dose.id);
      assert.equal(vista?.status, 'TOMADA');
      assert.equal(vista?.statusExibicao, 'TOMADA');
    });

    await step('12. excluir a conta (DELETE /api/cuidadores/me) -> 204', async () => {
      const r = await httpAuthService.deleteAccount();
      assert.equal(r.removalDeadlineDays, 0);
      contaExcluida = true;
    });

    token = tokenIdoso;
    const sessaoInvalida = await step('13. token do idoso após a exclusão -> 401 SESSAO_INVALIDA', () =>
      expectError(() => request('GET', '/api/idosos/me'), 401, 'SESSAO_INVALIDA'),
    );
    console.log(`    (${sessaoInvalida})`);

    token = null;
    const loginExcluido = await step('14. login com a conta excluída -> 401 CREDENCIAIS_INVALIDAS', () =>
      expectError(() => httpAuthService.login(email, senha), 401, 'CREDENCIAIS_INVALIDAS'),
    );
    console.log(`    (${loginExcluido})`);

    console.log('\nSMOKE OK: 14 passos');
  } catch (e) {
    console.error(`\nFALHOU no passo: ${passo}`);
    console.error(e instanceof Error ? e.message : e);
    if (!contaExcluida) {
      // Limpeza best-effort: a exclusão da conta apaga tudo o que o smoke criou
      try {
        token = (await httpAuthService.login(email, senha)).token;
        await httpAuthService.deleteAccount();
        console.error('Conta de teste removida.');
      } catch {
        console.error(`Atenção: não foi possível remover a conta de teste (${email}).`);
      }
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
