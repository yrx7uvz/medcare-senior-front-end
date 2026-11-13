import { describe, expect, it } from '@jest/globals';
import { decidePatientDoseOpen, type PatientDoseOpenContext } from '../src/lib/doseOpen';
import { parseReminderPayload } from '../src/lib/pushPayload';
import { createReminderScheduler, type ReminderNotificationsModule } from '../src/lib/reminderCore';
import {
  BATTERY_TIP,
  REMINDER_LATE_MESSAGE,
  REMINDER_OFF_MESSAGE,
  reminderDays,
  reminderIssues,
  reminderWarning,
} from '../src/lib/reminderHealth';
import {
  FIRST_REMINDER_TITLE,
  MAX_SCHEDULED_REMINDERS,
  REMINDER_CHANNEL_ID,
  REMINDER_CHANNEL_NAME,
  SECOND_REMINDER_TITLE,
  diffReminders,
  doseIdOfReminder,
  isReminderId,
  planReminders,
  reminderDosesSignature,
  reminderId,
  reminderIdsOf,
  type ReminderClock,
  type ReminderDose,
} from '../src/lib/reminderPlan';

// Relógio de teste: chave 'AAAA-MM-DDTHH:mm' lida em UTC, para o teste não depender do fuso da máquina
const instant = (key: string) => Date.parse(`${key}:00Z`);
const AGORA = instant('2026-11-13T07:30');
const MIN = 60_000;
const HORA = 60 * MIN;
/** Aparelho com o relógio certo. */
const CERTO: ReminderClock = { appNowMs: AGORA, deviceNowMs: AGORA };

function dose(id: string, scheduledAt: string, extra: Partial<ReminderDose> = {}): ReminderDose {
  return {
    id,
    patientId: '12',
    scheduledAt,
    storedStatus: 'PENDENTE',
    // Prazo de confirmação: horário + 30 (tolerância) + 30 (margem)
    confirmUntil: new Date(instant(scheduledAt) + 60 * MIN).toISOString().slice(0, 16),
    medication: { name: 'Losartana' },
    ...extra,
  };
}

const plan = (doses: ReminderDose[], clock: ReminderClock = CERTO) => planReminders(doses, clock, instant);

describe('lembrete local: o que agendar', () => {
  it('duas notificações por dose pendente: no horário e 10 minutos depois, com o texto do paciente', () => {
    const [primeiro, segundo] = plan([dose('7', '2026-11-13T08:00')]);

    expect(primeiro).toMatchObject({
      id: 'dose-7-1',
      kind: 1,
      triggerAtMs: instant('2026-11-13T08:00'),
      title: FIRST_REMINDER_TITLE,
      body: 'Tomar Losartana às 08:00',
    });
    expect(segundo).toMatchObject({
      id: 'dose-7-2',
      kind: 2,
      triggerAtMs: instant('2026-11-13T08:10'),
      title: SECOND_REMINDER_TITLE,
      body: 'Tomar Losartana às 08:00. Toque para confirmar.',
    });
    expect(SECOND_REMINDER_TITLE).toBe('Você ainda não confirmou o remédio');
    // Payload do toque: o mesmo formato do reforço do servidor, com o doseId
    expect(primeiro.data).toMatchObject({ tipo: 'LEMBRETE_DOSE', doseId: '7', pacienteId: '12', data: '2026-11-13', lembrete: '1' });
  });

  it('ignora doses confirmadas, encerradas e lembretes que já passaram (o segundo ainda pode valer)', () => {
    const planned = plan([
      dose('1', '2026-11-13T09:00', { storedStatus: 'CONFIRMADA_NO_HORARIO' }),
      dose('2', '2026-11-13T09:00', { storedStatus: 'NAO_TOMADA' }),
      // Horário já passou há 5 minutos: só a insistência (às 07:35) ainda vai tocar
      dose('3', '2026-11-13T07:25'),
      // Passou há 1 hora: nada
      dose('4', '2026-11-13T06:30'),
    ]);

    expect(planned.map((p) => p.id)).toEqual(['dose-3-2']);
  });

  it('o segundo lembrete só entra se a dose ainda puder ser confirmada', () => {
    const planned = plan([dose('5', '2026-11-13T08:00', { confirmUntil: '2026-11-13T08:05' })]);
    expect(planned.map((p) => p.id)).toEqual(['dose-5-1']);
  });

  it('janela de 72 horas: o que passa dela fica para a próxima sincronização', () => {
    const planned = plan([dose('1', '2026-11-16T07:29'), dose('2', '2026-11-16T07:30'), dose('3', '2026-11-16T07:31')]);
    // 07:30 + 72 h = 16/11 07:30 (inclusive); o segundo lembrete das 07:29 cai às 07:39, fora
    expect(planned.map((p) => p.id)).toEqual(['dose-1-1', 'dose-2-1']);
  });

  it('nunca mais de 60 notificações, das mais próximas para as mais distantes', () => {
    // 40 doses de 30 em 30 minutos = 80 lembretes; fora de ordem na entrada
    const doses = Array.from({ length: 40 }, (_, i) => {
      const at = new Date(AGORA + HORA + i * 30 * MIN).toISOString().slice(0, 16);
      return dose(String(100 + i), at);
    }).reverse();

    const planned = plan(doses);

    expect(planned).toHaveLength(MAX_SCHEDULED_REMINDERS);
    const gatilhos = planned.map((p) => p.triggerAtMs);
    expect(gatilhos).toEqual([...gatilhos].sort((a, b) => a - b));
    expect(planned[0].id).toBe('dose-100-1');
    // Os mais distantes ficaram de fora
    expect(planned.some((p) => p.doseId === '139')).toBe(false);
  });

  it('dose repetida (a mesma em duas listas) conta uma vez; horário ilegível é ignorado', () => {
    const planned = plan([dose('7', '2026-11-13T08:00'), dose('7', '2026-11-13T08:00'), dose('8', 'lixo')]);
    expect(planned.map((p) => p.id)).toEqual(['dose-7-1', 'dose-7-2']);
  });

  it('relógio do servidor: com o aparelho 5 minutos adiantado, o alarme é agendado 5 minutos mais tarde no relógio dele', () => {
    const adiantado: ReminderClock = { appNowMs: AGORA, deviceNowMs: AGORA + 5 * MIN };

    const [primeiro] = plan([dose('7', '2026-11-13T08:00')], adiantado);

    // Toca às 08:00 do servidor, que no relógio do aparelho são 08:05
    expect(primeiro.triggerAtMs).toBe(instant('2026-11-13T08:05'));
  });

  it('relógio do servidor: aparelho atrasado não perde a dose que, para o servidor, ainda vai acontecer', () => {
    // Aparelho 10 minutos atrasado: para ele são 07:20, mas o servidor está em 07:30
    const atrasado: ReminderClock = { appNowMs: AGORA, deviceNowMs: AGORA - 10 * MIN };

    const planned = plan([dose('7', '2026-11-13T07:31')], atrasado);

    expect(planned[0].triggerAtMs).toBe(instant('2026-11-13T07:21'));
  });
});

describe('lembrete local: identificadores e sincronização', () => {
  it('identificadores determinísticos por dose e tipo, e só os do lembrete são reconhecidos', () => {
    expect(reminderId('42', 1)).toBe('dose-42-1');
    expect(reminderIdsOf('42')).toEqual(['dose-42-1', 'dose-42-2']);
    expect(isReminderId('dose-42-2')).toBe(true);
    // IDs do demo têm hífen e dois-pontos
    expect(doseIdOfReminder('dose-d-t-losartana-2026-06-05T08:00-1')).toBe('d-t-losartana-2026-06-05T08:00');
    expect(isReminderId('dose-42-3')).toBe(false);
    expect(isReminderId('alerta-cuidador')).toBe(false);
  });

  it('com tudo já agendado, sincronizar de novo não muda nada', () => {
    const planned = plan([dose('7', '2026-11-13T08:00')]);
    const agendados = planned.map((p) => ({ id: p.id, signature: p.data.assinatura }));

    expect(diffReminders(planned, agendados, { complete: true })).toEqual({ toCancel: [], toSchedule: [], kept: ['dose-7-1', 'dose-7-2'] });
  });

  it('horário ou remédio mudou: reagenda só aquele; dose que sumiu é cancelada; o que não é lembrete nunca é tocado', () => {
    const antes = plan([dose('7', '2026-11-13T08:00'), dose('8', '2026-11-13T09:00')]);
    const agendados = [...antes.map((p) => ({ id: p.id, signature: p.data.assinatura })), { id: 'outra-coisa', signature: null }];
    // A dose 7 mudou para as 08:30 e a 8 foi confirmada (não vem mais no planejado)
    const depois = plan([dose('7', '2026-11-13T08:30')]);

    const diff = diffReminders(depois, agendados, { complete: true });

    expect(diff.toSchedule.map((p) => p.id)).toEqual(['dose-7-1', 'dose-7-2']);
    expect(diff.toCancel.sort()).toEqual(['dose-8-1', 'dose-8-2']);
    expect(diff.kept).toEqual([]);
  });

  it('sem rede (listas incompletas): mantém os agendados que não foram conferidos e só cancela as doses vistas', () => {
    const agendados = [
      { id: 'dose-1-1', signature: 'x' },
      { id: 'dose-2-1', signature: 'y' },
    ];
    // Só a lista de hoje veio, com a dose 2 confirmada
    const diff = diffReminders([], agendados, { complete: false, seenDoseIds: new Set(['2']) });

    expect(diff.toCancel).toEqual(['dose-2-1']);
    expect(diff.kept).toEqual(['dose-1-1']);
  });

  it('alarme exato liberado agora: reagenda tudo, mesmo o que não mudou', () => {
    const planned = plan([dose('7', '2026-11-13T08:00')]);
    const agendados = planned.map((p) => ({ id: p.id, signature: p.data.assinatura }));

    const diff = diffReminders(planned, agendados, { complete: true, force: true });

    expect(diff.toSchedule.map((p) => p.id)).toEqual(['dose-7-1', 'dose-7-2']);
    expect(diff.kept).toEqual([]);
  });
});

/** expo-notifications falso: guarda o que foi agendado, mostrado e cancelado. */
function notificacoesFalsas(permissao = 'granted') {
  const agendadas = new Map<string, { content: { data: Record<string, unknown>; title: string }; trigger: { date: number; channelId: string } }>();
  const naTela = new Set<string>();
  const canais: Record<string, Record<string, unknown>> = {};
  const chamadas = { agendar: 0, cancelar: [] as string[], tirarDaTela: [] as string[] };
  const mod = {
    AndroidImportance: { HIGH: 6, MAX: 7 },
    AndroidNotificationVisibility: { PUBLIC: 1 },
    AndroidAudioUsage: { ALARM: 4 },
    AndroidAudioContentType: { SONIFICATION: 4 },
    AndroidNotificationPriority: { MAX: 'max' },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationChannelAsync: async (id: string, canal: Record<string, unknown>) => {
      canais[id] = canal;
      return null;
    },
    getAllScheduledNotificationsAsync: async () =>
      [...agendadas.entries()].map(([identifier, r]) => ({ identifier, content: r.content, trigger: r.trigger })),
    scheduleNotificationAsync: async (req: { identifier: string; content: never; trigger: never }) => {
      chamadas.agendar += 1;
      agendadas.set(req.identifier, { content: req.content, trigger: req.trigger });
      return req.identifier;
    },
    cancelScheduledNotificationAsync: async (id: string) => {
      chamadas.cancelar.push(id);
      agendadas.delete(id);
    },
    dismissNotificationAsync: async (id: string) => {
      chamadas.tirarDaTela.push(id);
      naTela.delete(id);
    },
    getPresentedNotificationsAsync: async () => [...naTela].map((identifier) => ({ request: { identifier } })),
    getPermissionsAsync: async () => ({ status: permissao, canAskAgain: true }),
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    addNotificationResponseReceivedListener: () => ({ remove: () => undefined }),
    getLastNotificationResponseAsync: async () => null,
    clearLastNotificationResponse: () => undefined,
    setNotificationHandler: () => undefined,
  };
  return { mod: mod as unknown as ReminderNotificationsModule, agendadas, naTela, canais, chamadas };
}

describe('lembrete local: agendamento no aparelho (expo-notifications falso)', () => {
  it('canal próprio "Lembrete de remédio": importância máxima, som, vibração, luz, tela bloqueada e sem burlar o Não Perturbe', async () => {
    const falso = notificacoesFalsas();
    await createReminderScheduler({ os: 'android' }, () => falso.mod).ensureChannel();

    expect(Object.keys(falso.canais)).toEqual([REMINDER_CHANNEL_ID]);
    expect(falso.canais[REMINDER_CHANNEL_ID]).toMatchObject({
      name: REMINDER_CHANNEL_NAME,
      importance: 7,
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: 1,
      bypassDnd: false,
      audioAttributes: { usage: 4 },
    });
  });

  it('rodar duas vezes não duplica nem reagenda; cada alarme vai para o canal do lembrete na hora certa', async () => {
    const falso = notificacoesFalsas();
    const agenda = createReminderScheduler({ os: 'android' }, () => falso.mod);
    const planned = plan([dose('7', '2026-11-13T08:00'), dose('8', '2026-11-13T12:00')]);

    const primeira = await agenda.sync(planned, { complete: true });
    const segunda = await agenda.sync(planned, { complete: true });

    expect(primeira).toEqual({ scheduled: 4, cancelled: 0, kept: 0 });
    expect(segunda).toEqual({ scheduled: 0, cancelled: 0, kept: 4 });
    expect(falso.chamadas.agendar).toBe(4);
    expect([...falso.agendadas.keys()].sort()).toEqual(['dose-7-1', 'dose-7-2', 'dose-8-1', 'dose-8-2']);
    expect(falso.agendadas.get('dose-7-1')?.trigger).toEqual({ type: 'date', date: instant('2026-11-13T08:00'), channelId: 'lembrete-dose' });
  });

  it('confirmar a dose cancela os dois lembretes dela e tira da tela o que já apareceu; as outras doses continuam', async () => {
    const falso = notificacoesFalsas();
    const agenda = createReminderScheduler({ os: 'android' }, () => falso.mod);
    await agenda.sync(plan([dose('7', '2026-11-13T08:00'), dose('8', '2026-11-13T12:00')]), { complete: true });
    falso.naTela.add('dose-7-1');

    await agenda.cancelDose('7');

    expect([...falso.agendadas.keys()].sort()).toEqual(['dose-8-1', 'dose-8-2']);
    expect(falso.chamadas.tirarDaTela).toEqual(['dose-7-1', 'dose-7-2']);
    expect(falso.naTela.has('dose-7-1')).toBe(false);
  });

  it('sair da conta ou desconectar cancela todos os lembretes e nada mais', async () => {
    const falso = notificacoesFalsas();
    const agenda = createReminderScheduler({ os: 'android' }, () => falso.mod);
    await agenda.sync(plan([dose('7', '2026-11-13T08:00'), dose('8', '2026-11-13T12:00')]), { complete: true });
    falso.agendadas.set('aviso-do-cuidador', { content: { data: {}, title: 'x' }, trigger: { date: 0, channelId: 'alertas-dose' } });
    falso.naTela.add('dose-8-1');
    falso.naTela.add('outra');

    await agenda.cancelAll();

    expect([...falso.agendadas.keys()]).toEqual(['aviso-do-cuidador']);
    expect([...falso.naTela]).toEqual(['outra']);
    expect(await agenda.listScheduled()).toEqual([]);
  });

  it('o reforço do servidor sabe se o lembrete local da dose já está na tela', async () => {
    const falso = notificacoesFalsas();
    const agenda = createReminderScheduler({ os: 'android' }, () => falso.mod);
    falso.naTela.add('dose-7-1');

    expect(await agenda.isPresented('dose-7-1')).toBe(true);
    expect(await agenda.isPresented('dose-8-1')).toBe(false);
  });

  it('permissão, toque, notificação que abriu o app e banner com o app aberto (onde o push não existe)', async () => {
    const falso = notificacoesFalsas('denied');
    const ouvintes: ((r: unknown) => void)[] = [];
    let handler: ((n: unknown) => Promise<{ shouldShowBanner: boolean }>) | null = null;
    let ultima: unknown = { notification: { request: { content: { data: { tipo: 'LEMBRETE_DOSE', doseId: '7' } } } } };
    const mod = {
      ...(falso.mod as unknown as Record<string, unknown>),
      addNotificationResponseReceivedListener: (cb: (r: unknown) => void) => {
        ouvintes.push(cb);
        return { remove: () => ouvintes.splice(0) };
      },
      getLastNotificationResponseAsync: async () => ultima,
      clearLastNotificationResponse: () => {
        ultima = null;
      },
      setNotificationHandler: (h: { handleNotification: typeof handler }) => {
        handler = h.handleNotification;
      },
    } as unknown as ReminderNotificationsModule;
    const agenda = createReminderScheduler({ os: 'android' }, () => mod);

    expect(await agenda.getPermission()).toBe('denied');
    expect(await agenda.canAskAgain()).toBe(true);
    expect(await agenda.requestPermission()).toBe('granted');

    const tocados: Record<string, unknown>[] = [];
    const parar = agenda.onOpen((d) => tocados.push(d));
    ouvintes.forEach((cb) => cb({ notification: { request: { content: { data: { doseId: '8' } } } } }));
    parar();
    expect(tocados).toEqual([{ doseId: '8' }]);
    expect(await agenda.getLaunchData()).toEqual({ tipo: 'LEMBRETE_DOSE', doseId: '7' });
    // Consumida: a próxima abertura não reabre a mesma dose
    expect(await agenda.getLaunchData()).toBeNull();

    agenda.showInForeground((data) => data.tipo === 'LEMBRETE_DOSE');
    expect((await handler!({ request: { content: { data: { tipo: 'LEMBRETE_DOSE' } } } })).shouldShowBanner).toBe(true);
    expect((await handler!({ request: { content: { data: { tipo: 'OUTRO' } } } })).shouldShowBanner).toBe(false);
    expect((await handler!(undefined)).shouldShowBanner).toBe(false);
  });

  it('um lembrete que não agenda não impede os outros', async () => {
    const falso = notificacoesFalsas();
    let vez = 0;
    const mod = {
      ...(falso.mod as unknown as Record<string, unknown>),
      scheduleNotificationAsync: async (req: { identifier: string }) => {
        vez += 1;
        if (vez === 1) throw new Error('falhou');
        return req.identifier;
      },
    } as unknown as ReminderNotificationsModule;

    const r = await createReminderScheduler({ os: 'android' }, () => mod).sync(plan([dose('7', '2026-11-13T08:00')]), { complete: true });

    expect(r.scheduled).toBe(1);
  });

  it('fora do Android é inerte e nem carrega o módulo; módulo que falha não derruba o app', async () => {
    let carregou = false;
    const web = createReminderScheduler({ os: 'web' }, () => {
      carregou = true;
      throw new Error('não deveria carregar');
    });
    expect(web.supported).toBe(false);
    expect(await web.sync([], { complete: true })).toEqual({ scheduled: 0, cancelled: 0, kept: 0 });
    await web.cancelAll();
    expect(carregou).toBe(false);

    const quebrado = createReminderScheduler({ os: 'android' }, () => {
      throw new Error('sem módulo nativo');
    });
    expect(await quebrado.getPermission()).toBe('unavailable');
    await expect(quebrado.cancelDose('7')).resolves.toBeUndefined();
  });
});

describe('lembrete: aviso de notificações, alarme exato e bateria', () => {
  it('sem notificações, o aviso é que o lembrete está desligado (vem antes do alarme)', () => {
    expect(reminderIssues({ supported: true, permission: 'denied', exactAlarm: false })).toEqual(['NOTIFICACOES_DESLIGADAS', 'ALARME_INEXATO']);
    expect(reminderWarning({ supported: true, permission: 'undetermined', exactAlarm: true })?.message).toBe(REMINDER_OFF_MESSAGE);
  });

  it('sem alarme exato, o aviso é "O lembrete pode atrasar. Toque aqui para ativar."', () => {
    expect(reminderWarning({ supported: true, permission: 'granted', exactAlarm: false })).toMatchObject({
      issue: 'ALARME_INEXATO',
      message: REMINDER_LATE_MESSAGE,
    });
    expect(REMINDER_LATE_MESSAGE).toBe('O lembrete pode atrasar. Toque aqui para ativar.');
  });

  it('tudo certo, sem saber (Expo Go) ou fora do Android: nenhum aviso', () => {
    expect(reminderWarning({ supported: true, permission: 'granted', exactAlarm: true })).toBeNull();
    expect(reminderWarning({ supported: true, permission: 'granted', exactAlarm: null })).toBeNull();
    expect(reminderWarning({ supported: true, permission: null, exactAlarm: null })).toBeNull();
    expect(reminderWarning({ supported: false, permission: 'denied', exactAlarm: false })).toBeNull();
    expect(BATTERY_TIP).toContain('Sem restrições');
  });

  it('dias consultados: hoje e os três seguintes cobrem as 72 horas, inclusive na virada do mês', () => {
    expect(reminderDays('2026-11-29')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  });
});

describe('lembrete: toque na notificação', () => {
  const PAYLOAD = { tipo: 'LEMBRETE_DOSE', doseId: '5000', pacienteId: '12', data: '2026-11-13' };
  const ALVO = { doseId: '5000', patientId: '12', day: '2026-11-13' };
  const PACIENTE: PatientDoseOpenContext = { viewAs: 'PATIENT', profileLoaded: true, patientId: '12', unlocked: true };

  it('o lembrete local e o do servidor têm o mesmo payload e abrem a mesma dose', () => {
    expect(parseReminderPayload(PAYLOAD)).toEqual(ALVO);
    expect(parseReminderPayload({ ...PAYLOAD, lembrete: '2', assinatura: 'x' })).toEqual(ALVO);
    // Demo: IDs de texto
    expect(parseReminderPayload({ ...PAYLOAD, doseId: 'd-t-losartana-2026-06-05T08:00', pacienteId: 'e-jose' })).toEqual({
      doseId: 'd-t-losartana-2026-06-05T08:00',
      patientId: 'e-jose',
      day: '2026-11-13',
    });
  });

  it.each([
    ['aviso do cuidador', { ...PAYLOAD, tipo: 'DOSE_NAO_CONFIRMADA' }],
    ['sem doseId', { ...PAYLOAD, doseId: '' }],
    ['data inválida', { ...PAYLOAD, data: '13/11/2026' }],
    ['texto solto', 'LEMBRETE_DOSE'],
    ['nulo', null],
  ])('payload inválido (%s) é ignorado', (_nome, payload) => {
    expect(parseReminderPayload(payload)).toBeNull();
  });

  it('desbloqueado abre a dose; com o PIN pedido, espera o desbloqueio (o lembrete não contorna o PIN)', () => {
    expect(decidePatientDoseOpen(ALVO, PACIENTE)).toEqual({ action: 'abrir-dose', target: ALVO });
    expect(decidePatientDoseOpen(ALVO, { ...PACIENTE, unlocked: false })).toEqual({ action: 'aguardar' });
    expect(decidePatientDoseOpen(ALVO, { ...PACIENTE, profileLoaded: false })).toEqual({ action: 'aguardar' });
  });

  it('no perfil do cuidador, sem paciente pareado ou de outro paciente: ignora', () => {
    expect(decidePatientDoseOpen(ALVO, { ...PACIENTE, viewAs: 'CAREGIVER' })).toEqual({ action: 'ignorar' });
    expect(decidePatientDoseOpen(ALVO, { ...PACIENTE, patientId: null })).toEqual({ action: 'ignorar' });
    expect(decidePatientDoseOpen(ALVO, { ...PACIENTE, patientId: '99' })).toEqual({ action: 'ignorar' });
    expect(decidePatientDoseOpen(null, PACIENTE)).toEqual({ action: 'ignorar' });
  });
});

describe('mudança na lista de doses do dia (sincroniza na hora com o app aberto)', () => {
  const base = [
    { id: '1', scheduledAt: '2026-11-13T19:42:00', storedStatus: 'PENDENTE' as const },
    { id: '2', scheduledAt: '2026-11-13T19:45:00', storedStatus: 'PENDENTE' as const },
  ];

  it('a mesma lista, em qualquer ordem, tem a mesma assinatura', () => {
    expect(reminderDosesSignature([...base].reverse())).toBe(reminderDosesSignature(base));
  });

  it('remédio novo, horário alterado ou dose confirmada mudam a assinatura', () => {
    const sig = reminderDosesSignature(base);
    expect(reminderDosesSignature([...base, { id: '3', scheduledAt: '2026-11-13T19:47:00', storedStatus: 'PENDENTE' }])).not.toBe(sig);
    expect(reminderDosesSignature([base[0], { ...base[1], scheduledAt: '2026-11-13T19:50:00' }])).not.toBe(sig);
    expect(reminderDosesSignature([base[0], { ...base[1], storedStatus: 'CONFIRMADA_NO_HORARIO' }])).not.toBe(sig);
  });
});
