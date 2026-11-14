import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * sincronizarLembretesDoPaciente() de ponta a ponta no app: store, relógio do servidor, plano e agendamento de verdade;
 * falsos só o Android (react-native e expo-notifications) e a API (services). Agora: 13/11/2026 07:30 em São Paulo.
 */

type Agendada = { identifier: string; content: { data: Record<string, unknown> }; trigger: { date: number } };

const mockAgendadas = new Map<string, Agendada>();
const mockListForDay = jest.fn<(patientId: string, day: string) => Promise<unknown[]>>();

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

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) },
}));
jest.mock('expo-notifications', () => mockNotificacoes);
// APK sem o alarme nativo: valem os dois lembretes do expo-notifications (o alarme está em alarmeSessao.test.ts)
jest.mock('../modules/medcare-alarmes', () => ({ medcareAlarmes: null }));
jest.mock('../src/lib/push', () => ({ push: { supported: false } }));
jest.mock('../src/services', () => ({ services: { doses: { listForDay: (p: string, d: string) => mockListForDay(p, d) } } }));

// Carregados depois dos falsos
/* eslint-disable @typescript-eslint/no-require-imports */
const { useAppStore } = require('../src/store/appStore') as typeof import('../src/store/appStore');
const reminders = require('../src/lib/reminders') as typeof import('../src/lib/reminders');
const serverClock = require('../src/lib/serverClock') as typeof import('../src/lib/serverClock');
/* eslint-enable @typescript-eslint/no-require-imports */

const AGORA = Date.parse('2026-11-13T10:30:00Z');

function dose(id: string, scheduledAt: string, storedStatus = 'PENDENTE') {
  return {
    id,
    patientId: '12',
    scheduledAt,
    storedStatus,
    confirmUntil: `${scheduledAt.slice(0, 11)}23:59`,
    medication: { name: 'Losartana' },
  };
}

function comoPaciente() {
  useAppStore.setState({
    profileLoaded: true,
    patientSessionLoaded: true,
    viewAs: 'PATIENT',
    patientSession: { patientId: '12', token: 'jwt-do-paciente' },
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: AGORA, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  mockAgendadas.clear();
  mockListForDay.mockReset();
  serverClock.resetServerClock();
  mockListForDay.mockImplementation(async (_p, day) => (day === '2026-11-13' ? [dose('7', '2026-11-13T08:00')] : []));
});

afterEach(() => {
  jest.useRealTimers();
  useAppStore.setState({ profileLoaded: false, patientSessionLoaded: false, viewAs: null, patientSession: null });
});

describe('sincronizarLembretesDoPaciente', () => {
  it('paciente pareado: agenda os dois lembretes a partir das listas de hoje e dos 3 dias seguintes', async () => {
    comoPaciente();

    expect(await reminders.sincronizarLembretesDoPaciente()).toBe('SINCRONIZADO');

    expect(mockListForDay.mock.calls.map((c) => c[1])).toEqual(['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']);
    expect([...mockAgendadas.keys()].sort()).toEqual(['dose-7-1', 'dose-7-2']);
    // 08:00 em São Paulo = 11:00 UTC
    expect(mockAgendadas.get('dose-7-1')?.trigger.date).toBe(Date.parse('2026-11-13T11:00:00Z'));
  });

  it('rodar duas vezes não duplica nem reagenda', async () => {
    comoPaciente();
    await reminders.sincronizarLembretesDoPaciente();
    const primeira = mockAgendadas.get('dose-7-1');

    await reminders.sincronizarLembretesDoPaciente();

    expect(mockAgendadas.size).toBe(2);
    expect(mockAgendadas.get('dose-7-1')).toBe(primeira);
  });

  it('relógio do servidor: com o servidor 10 minutos à frente do aparelho, o alarme toca 10 minutos antes no relógio do aparelho', async () => {
    comoPaciente();
    // Resposta da API carimbada 10 minutos à frente do relógio do aparelho
    serverClock.recordServerDate(new Date(AGORA + 10 * 60_000).toUTCString(), AGORA, AGORA);

    await reminders.sincronizarLembretesDoPaciente();

    const esperado = Date.parse('2026-11-13T11:00:00Z') - serverClock.serverOffsetMs();
    expect(serverClock.serverOffsetMs()).toBeGreaterThan(9 * 60_000);
    expect(mockAgendadas.get('dose-7-1')?.trigger.date).toBe(esperado);
  });

  it('dose confirmada (no servidor ou neste aparelho) sai do agendamento', async () => {
    comoPaciente();
    await reminders.sincronizarLembretesDoPaciente();

    mockListForDay.mockImplementation(async (_p, day) => (day === '2026-11-13' ? [dose('7', '2026-11-13T08:00', 'CONFIRMADA_NO_HORARIO')] : []));
    await reminders.sincronizarLembretesDoPaciente();
    expect(mockAgendadas.size).toBe(0);

    // E o cancelamento direto, usado logo depois de confirmar na tela da dose
    mockListForDay.mockImplementation(async (_p, day) => (day === '2026-11-13' ? [dose('8', '2026-11-13T09:00')] : []));
    await reminders.sincronizarLembretesDoPaciente();
    await reminders.cancelarLembretesDaDose('8');
    expect(mockAgendadas.size).toBe(0);
  });

  it('sem internet: os lembretes já agendados continuam (o paciente é lembrado mesmo offline)', async () => {
    comoPaciente();
    await reminders.sincronizarLembretesDoPaciente();
    mockListForDay.mockRejectedValue(new Error('sem rede'));

    expect(await reminders.sincronizarLembretesDoPaciente()).toBe('SEM_REDE');

    expect([...mockAgendadas.keys()].sort()).toEqual(['dose-7-1', 'dose-7-2']);
  });

  it('sair da conta, desconexão ou troca de perfil: cancela tudo', async () => {
    comoPaciente();
    await reminders.sincronizarLembretesDoPaciente();

    useAppStore.setState({ patientSession: null });
    expect(await reminders.sincronizarLembretesDoPaciente()).toBe('NAO_PACIENTE');

    expect(mockAgendadas.size).toBe(0);
  });

  it('o aparelho do cuidador nunca agenda lembrete de dose (nem consulta as doses para isso)', async () => {
    useAppStore.setState({
      profileLoaded: true,
      patientSessionLoaded: true,
      viewAs: 'CAREGIVER',
      // Mesmo com um paciente pareado guardado no aparelho
      patientSession: { patientId: '12', token: 'jwt-do-paciente' },
    });

    expect(await reminders.sincronizarLembretesDoPaciente()).toBe('NAO_PACIENTE');

    expect(mockListForDay).not.toHaveBeenCalled();
    expect(mockAgendadas.size).toBe(0);
  });

  it('antes do boot ler a sessão, não faz nada (e não cancela por engano)', async () => {
    mockAgendadas.set('dose-7-1', { identifier: 'dose-7-1', content: { data: {} }, trigger: { date: 0 } });

    expect(await reminders.sincronizarLembretesDoPaciente()).toBe('AGUARDANDO');

    expect(mockAgendadas.has('dose-7-1')).toBe(true);
  });
});
