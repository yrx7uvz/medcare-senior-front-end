import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * Alarme da dose ligado à sessão (reminders.ts com o módulo nativo presente): store, relógio do servidor e plano de
 * verdade; falsos o Android (react-native, expo-notifications e o módulo medcare-alarmes) e a API.
 * Agora: 13/11/2026 07:30 em São Paulo.
 */

type Agendada = { identifier: string; content: { data: Record<string, unknown> }; trigger: { date: number } };

const mockAgendadas = new Map<string, Agendada>();
const mockAlarmes = new Map<string, Record<string, unknown>>();
const mockListForDay = jest.fn<(patientId: string, day: string) => Promise<unknown[]>>();
const mockEstado = { abertura: null as string | null, quebrado: false };

const mockNotificacoes = {
  AndroidImportance: { MAX: 7 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  AndroidAudioUsage: { ALARM: 4 },
  AndroidAudioContentType: { SONIFICATION: 4 },
  AndroidNotificationPriority: { MAX: 'max' },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationChannelAsync: async () => null,
  getAllScheduledNotificationsAsync: async () => [...mockAgendadas.values()],
  scheduleNotificationAsync: async (req: Agendada) => {
    mockAgendadas.set(req.identifier, req);
    return req.identifier;
  },
  cancelScheduledNotificationAsync: async (id: string) => {
    mockAgendadas.delete(id);
  },
  dismissNotificationAsync: async () => undefined,
  getPresentedNotificationsAsync: async () => [],
};

const mockNativo = {
  podeAgendarAlarmeExato: () => true,
  ignoraOtimizacaoDeBateria: () => true,
  abrirAjusteDeAlarmeExato: () => true,
  abrirAjusteDeBateria: () => true,
  agendarAlarmes: (json: string) => {
    if (mockEstado.quebrado) throw new Error('nativo');
    const lista = JSON.parse(json) as Record<string, unknown>[];
    lista.forEach((a) => mockAlarmes.set(String(a.doseId), a));
    return lista.length;
  },
  listarAlarmes: () => [...mockAlarmes.keys()],
  cancelarAlarme: (id: string) => {
    mockAlarmes.delete(id);
  },
  cancelarTodosOsAlarmes: () => mockAlarmes.clear(),
  tomarAberturaPendente: () => {
    const valor = mockEstado.abertura;
    mockEstado.abertura = null;
    return valor;
  },
};

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) },
}));
jest.mock('expo-notifications', () => mockNotificacoes);
jest.mock('../modules/medcare-alarmes', () => ({ medcareAlarmes: mockNativo }));
jest.mock('../src/lib/push', () => ({ push: { supported: false } }));
jest.mock('../src/services', () => ({ services: { doses: { listForDay: (p: string, d: string) => mockListForDay(p, d) } } }));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useAppStore } = require('../src/store/appStore') as typeof import('../src/store/appStore');
const reminders = require('../src/lib/reminders') as typeof import('../src/lib/reminders');
const serverClock = require('../src/lib/serverClock') as typeof import('../src/lib/serverClock');
/* eslint-enable @typescript-eslint/no-require-imports */

const AGORA = Date.parse('2026-11-13T10:30:00Z');

function dose(id: string, scheduledAt: string, storedStatus = 'PENDENTE') {
  return { id, patientId: '12', scheduledAt, storedStatus, confirmUntil: `${scheduledAt.slice(0, 11)}23:59`, medication: { name: 'Losartana' } };
}

function comoPaciente() {
  useAppStore.setState({
    profileLoaded: true,
    patientSessionLoaded: true,
    viewAs: 'PATIENT',
    patientSession: { patientId: '12', token: 'jwt-do-paciente' },
    pendingPatientDoseOpen: null,
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: AGORA, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  mockAgendadas.clear();
  mockAlarmes.clear();
  mockEstado.abertura = null;
  mockEstado.quebrado = false;
  mockListForDay.mockReset();
  serverClock.resetServerClock();
  mockListForDay.mockImplementation(async (_p, day) => (day === '2026-11-13' ? [dose('7', '2026-11-13T08:00')] : []));
});

afterEach(() => {
  jest.useRealTimers();
  useAppStore.setState({ profileLoaded: false, patientSessionLoaded: false, viewAs: null, patientSession: null, pendingPatientDoseOpen: null });
});

describe('alarme da dose na sessão do paciente', () => {
  it('com o módulo nativo, a dose vira alarme e os lembretes comuns saem (inclusive os que já estavam agendados)', async () => {
    comoPaciente();
    mockAgendadas.set('dose-7-1', { identifier: 'dose-7-1', content: { data: { assinatura: 'x' } }, trigger: { date: 0 } });

    expect(reminders.doseAlarms.supported).toBe(true);
    expect(await reminders.sincronizarLembretesDoPaciente()).toBe('SINCRONIZADO');

    expect(mockAgendadas.size).toBe(0);
    expect(mockAlarmes.get('7')).toMatchObject({
      corpo: 'Tomar Losartana às 08:00',
      // 08:00 em São Paulo = 11:00 UTC; prazo 23:59
      disparoMs: Date.parse('2026-11-13T11:00:00Z'),
      ateMs: Date.parse('2026-11-14T02:59:00Z'),
    });
  });

  it('dose confirmada para o alarme na hora; na sincronização seguinte, ele não volta', async () => {
    comoPaciente();
    await reminders.sincronizarLembretesDoPaciente();

    await reminders.cancelarLembretesDaDose('7');
    expect(mockAlarmes.has('7')).toBe(false);

    mockListForDay.mockImplementation(async (_p, day) => (day === '2026-11-13' ? [dose('7', '2026-11-13T08:00', 'CONFIRMADA_NO_HORARIO')] : []));
    await reminders.sincronizarLembretesDoPaciente();
    expect(mockAlarmes.size).toBe(0);
  });

  it('saída do perfil do paciente cancela todos os alarmes', async () => {
    comoPaciente();
    await reminders.sincronizarLembretesDoPaciente();

    useAppStore.setState({ viewAs: 'CAREGIVER' });
    expect(await reminders.sincronizarLembretesDoPaciente()).toBe('NAO_PACIENTE');
    expect(mockAlarmes.size).toBe(0);
  });

  it('nativo com falha: os dois lembretes comuns assumem', async () => {
    comoPaciente();
    mockEstado.quebrado = true;

    await reminders.sincronizarLembretesDoPaciente();

    expect([...mockAgendadas.keys()].sort()).toEqual(['dose-7-1', 'dose-7-2']);
  });

  it('o reforço do servidor não repete o aviso de uma dose que tem alarme', async () => {
    comoPaciente();
    await reminders.sincronizarLembretesDoPaciente();
    const payload = { tipo: 'LEMBRETE_DOSE', doseId: '7', pacienteId: '12', data: '2026-11-13' };

    expect(await reminders.reminderInForeground(payload, true)).toBe(false);
    expect(await reminders.reminderInForeground({ ...payload, doseId: '99' }, true)).toBe(true);
  });

  it('"Tomar o remédio" na tela do alarme abre a dose no app, uma vez só', () => {
    comoPaciente();
    mockEstado.abertura = '{"doseId":"7","pacienteId":"12","data":"2026-11-13"}';

    expect(reminders.abrirDoseDoAlarme()).toBe(true);
    expect(useAppStore.getState().pendingPatientDoseOpen).toEqual({ doseId: '7', patientId: '12', day: '2026-11-13' });
    expect(reminders.abrirDoseDoAlarme()).toBe(false);
  });

  it('antes do boot ler o perfil, a dose espera; fora do perfil do paciente, é descartada', () => {
    mockEstado.abertura = '{"doseId":"7","pacienteId":"12","data":"2026-11-13"}';
    useAppStore.setState({ profileLoaded: false });
    expect(reminders.abrirDoseDoAlarme()).toBe(false);
    expect(mockEstado.abertura).not.toBeNull();

    useAppStore.setState({ profileLoaded: true, viewAs: 'CAREGIVER' });
    expect(reminders.abrirDoseDoAlarme()).toBe(false);
    expect(mockEstado.abertura).toBeNull();
    expect(useAppStore.getState().pendingPatientDoseOpen).toBeNull();
  });
});
