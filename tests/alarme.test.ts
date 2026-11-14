import { describe, expect, it } from '@jest/globals';
import type { MedcareAlarmesNativo } from '../modules/medcare-alarmes';
import { FALLBACK_DEADLINE_MS, alarmsToCancel, createDoseAlarms, pendingOpenPayload, planAlarms } from '../src/lib/doseAlarm';
import type { ReminderDose } from '../src/lib/reminderPlan';
import { reminderIssues, reminderWarning, REMINDER_FULL_SCREEN_ACTION, REMINDER_FULL_SCREEN_MESSAGE } from '../src/lib/reminderHealth';

/**
 * Alarme da dose (doseAlarm.ts): o plano puro e a ponte com o módulo nativo, com um nativo falso. Horários das doses
 * como instantes UTC simples ('AAAA-MM-DDTHH:mm' + 'Z'), sem diferença entre os relógios.
 */

const AGORA = Date.parse('2026-11-13T10:00:00Z');
const relogio = { appNowMs: AGORA, deviceNowMs: AGORA };
// Só o formato da API: o Date.parse do V8 aceita até "lixo:00Z"
const instante = (key: string) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(key) ? Date.parse(`${key}:00Z`) : null);

function dose(id: string, scheduledAt: string, confirmUntil: string, storedStatus: ReminderDose['storedStatus'] = 'PENDENTE'): ReminderDose {
  return { id, patientId: '12', scheduledAt, confirmUntil, storedStatus, medication: { name: ' Losartana ' } };
}

describe('planAlarms', () => {
  it('um alarme por dose pendente: toca no horário e vale até o prazo de confirmação', () => {
    const plano = planAlarms([dose('7', '2026-11-13T11:00', '2026-11-13T12:00')], relogio, instante);

    expect(plano).toEqual([
      {
        doseId: '7',
        pacienteId: '12',
        data: '2026-11-13',
        titulo: 'Hora do remédio',
        corpo: 'Tomar Losartana às 11:00',
        disparoMs: Date.parse('2026-11-13T11:00:00Z'),
        ateMs: Date.parse('2026-11-13T12:00:00Z'),
      },
    ]);
  });

  it('dose cujo horário passou continua enquanto pode ser confirmada (o alarme dela pode estar tocando ou adiado)', () => {
    const plano = planAlarms(
      [dose('1', '2026-11-13T09:40', '2026-11-13T10:30'), dose('2', '2026-11-13T09:00', '2026-11-13T09:59')],
      relogio,
      instante,
    );
    expect(plano.map((a) => a.doseId)).toEqual(['1']);
  });

  it('ignora confirmadas, repetidas, horários ilegíveis e doses além da janela de 72 horas', () => {
    const plano = planAlarms(
      [
        dose('1', '2026-11-13T11:00', '2026-11-13T12:00', 'CONFIRMADA_NO_HORARIO'),
        dose('2', '2026-11-13T12:00', '2026-11-13T13:00'),
        dose('2', '2026-11-13T12:00', '2026-11-13T13:00'),
        dose('3', 'lixo', '2026-11-13T13:00'),
        dose('4', '2026-11-16T11:00', '2026-11-16T12:00'),
      ],
      relogio,
      instante,
    );
    expect(plano.map((a) => a.doseId)).toEqual(['2']);
  });

  it('sem prazo legível, o alarme vale 1 hora depois do horário', () => {
    const [alarme] = planAlarms([dose('1', '2026-11-13T11:00', '')], relogio, instante);
    expect(alarme.ateMs - alarme.disparoMs).toBe(FALLBACK_DEADLINE_MS);
  });

  it('leva os horários do relógio do servidor para o do aparelho e ordena do mais próximo ao mais distante', () => {
    // Servidor 10 minutos à frente: o alarme toca 10 minutos antes no relógio do aparelho
    const plano = planAlarms(
      [dose('b', '2026-11-13T15:00', '2026-11-13T16:00'), dose('a', '2026-11-13T11:00', '2026-11-13T12:00')],
      { appNowMs: AGORA + 600_000, deviceNowMs: AGORA },
      instante,
    );
    expect(plano.map((a) => a.doseId)).toEqual(['a', 'b']);
    expect(plano[0].disparoMs).toBe(Date.parse('2026-11-13T10:50:00Z'));
  });

  it('respeita o limite de alarmes', () => {
    const doses = Array.from({ length: 5 }, (_, i) => dose(String(i), `2026-11-13T1${i + 1}:00`, `2026-11-13T1${i + 1}:30`));
    expect(planAlarms(doses, relogio, instante, { max: 3 }).map((a) => a.doseId)).toEqual(['0', '1', '2']);
  });
});

describe('alarmsToCancel', () => {
  const plano = planAlarms([dose('7', '2026-11-13T11:00', '2026-11-13T12:00')], relogio, instante);

  it('lista completa: sai todo alarme fora do plano', () => {
    expect(alarmsToCancel(plano, ['7', '8', '9'], { complete: true })).toEqual(['8', '9']);
  });

  it('sem rede em algum dia: só sai o alarme das doses que vieram (as confirmadas)', () => {
    expect(alarmsToCancel(plano, ['7', '8', '9'], { complete: false, seenDoseIds: new Set(['7', '8']) })).toEqual(['8']);
  });
});

describe('pendingOpenPayload', () => {
  it('a dose da tela do alarme vira o payload do lembrete', () => {
    expect(pendingOpenPayload('{"doseId":"7","pacienteId":"12","data":"2026-11-13"}')).toEqual({
      tipo: 'LEMBRETE_DOSE',
      doseId: '7',
      pacienteId: '12',
      data: '2026-11-13',
    });
  });

  it('qualquer outra coisa é ignorada', () => {
    expect(pendingOpenPayload(null)).toBeNull();
    expect(pendingOpenPayload('não é json')).toBeNull();
    expect(pendingOpenPayload('{"doseId":"7"}')).toBeNull();
    expect(pendingOpenPayload('{"doseId":"7 OR 1=1","data":"2026-11-13"}')).toBeNull();
  });
});

function nativoFalso() {
  const gravados = new Map<string, Record<string, unknown>>();
  const chamadas: string[] = [];
  let abertura: string | null = null;
  const nativo: MedcareAlarmesNativo = {
    podeAgendarAlarmeExato: () => true,
    ignoraOtimizacaoDeBateria: () => true,
    abrirAjusteDeAlarmeExato: () => true,
    abrirAjusteDeBateria: () => true,
    agendarAlarmes: (json, forcar) => {
      const lista = JSON.parse(json) as Record<string, unknown>[];
      lista.forEach((a) => gravados.set(String(a.doseId), a));
      chamadas.push(`agendar:${lista.length}:${forcar}`);
      return lista.length;
    },
    listarAlarmes: () => [...gravados.keys()],
    cancelarAlarme: (id) => {
      gravados.delete(id);
      chamadas.push(`cancelar:${id}`);
    },
    cancelarTodosOsAlarmes: () => {
      gravados.clear();
      chamadas.push('cancelarTodos');
    },
    tomarAberturaPendente: () => {
      const valor = abertura;
      abertura = null;
      return valor;
    },
  };
  return { nativo, gravados, chamadas, abrir: (json: string) => (abertura = json) };
}

describe('createDoseAlarms', () => {
  it('fora do Android, sem o módulo ou com um APK antigo (sem as funções do alarme), fica inerte', () => {
    const { nativo } = nativoFalso();
    expect(createDoseAlarms({ os: 'web' }, nativo).supported).toBe(false);
    expect(createDoseAlarms({ os: 'android' }, null).supported).toBe(false);
    const antigo: MedcareAlarmesNativo = { ...nativo, agendarAlarmes: undefined };
    const inerte = createDoseAlarms({ os: 'android' }, antigo);
    expect(inerte.supported).toBe(false);
    expect(inerte.sync([], { complete: true })).toBe(false);
    expect(inerte.has('7')).toBe(false);
    expect(inerte.takePendingOpen()).toBeNull();
  });

  it('sincroniza: cancela o que saiu do plano e manda o resto ao nativo (forçar só quando pedido)', () => {
    const { nativo, gravados, chamadas } = nativoFalso();
    const alarmes = createDoseAlarms({ os: 'android' }, nativo);
    gravados.set('velho', {});
    const plano = planAlarms([dose('7', '2026-11-13T11:00', '2026-11-13T12:00')], relogio, instante);

    expect(alarmes.sync(plano, { complete: true })).toBe(true);
    expect(chamadas).toEqual(['cancelar:velho', 'agendar:1:false']);
    expect(alarmes.has('7')).toBe(true);

    alarmes.sync(plano, { complete: true, force: true });
    expect(chamadas.at(-1)).toBe('agendar:1:true');

    alarmes.cancelDose('7');
    expect(alarmes.has('7')).toBe(false);
  });

  it('a dose de "Tomar o remédio" sai uma vez só', () => {
    const { nativo, abrir } = nativoFalso();
    const alarmes = createDoseAlarms({ os: 'android' }, nativo);
    abrir('{"doseId":"7","pacienteId":"12","data":"2026-11-13"}');

    expect(alarmes.takePendingOpen()).toMatchObject({ doseId: '7', tipo: 'LEMBRETE_DOSE' });
    expect(alarmes.takePendingOpen()).toBeNull();
  });

  it('falha do nativo nunca derruba o app: a sincronização avisa (para o lembrete comum assumir)', () => {
    const { nativo } = nativoFalso();
    const quebrado: MedcareAlarmesNativo = {
      ...nativo,
      agendarAlarmes: () => {
        throw new Error('nativo');
      },
      listarAlarmes: () => {
        throw new Error('nativo');
      },
      cancelarAlarme: () => {
        throw new Error('nativo');
      },
      cancelarTodosOsAlarmes: () => {
        throw new Error('nativo');
      },
      tomarAberturaPendente: () => {
        throw new Error('nativo');
      },
    };
    const alarmes = createDoseAlarms({ os: 'android' }, quebrado);
    expect(alarmes.sync([], { complete: true })).toBe(false);
    expect(alarmes.has('7')).toBe(false);
    expect(() => alarmes.cancelDose('7')).not.toThrow();
    expect(() => alarmes.cancelAll()).not.toThrow();
    expect(alarmes.takePendingOpen()).toBeNull();
  });
});

describe('aviso da tela cheia do alarme (Android 14+)', () => {
  it('vem depois de notificações e alarme exato, e "não sei" não vira aviso', () => {
    expect(reminderIssues({ supported: true, permission: 'denied', exactAlarm: false, fullScreen: false })).toEqual([
      'NOTIFICACOES_DESLIGADAS',
      'ALARME_INEXATO',
      'TELA_CHEIA_BLOQUEADA',
    ]);
    expect(reminderWarning({ supported: true, permission: 'granted', exactAlarm: true, fullScreen: false })).toEqual({
      issue: 'TELA_CHEIA_BLOQUEADA',
      message: REMINDER_FULL_SCREEN_MESSAGE,
      action: REMINDER_FULL_SCREEN_ACTION,
    });
    expect(reminderWarning({ supported: true, permission: 'granted', exactAlarm: true, fullScreen: null })).toBeNull();
  });
});
