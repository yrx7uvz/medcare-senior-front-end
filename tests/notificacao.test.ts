import { describe, expect, it } from '@jest/globals';
import {
  FOREIGN_PATIENT_NOTICE,
  MISSING_DOSE_NOTICE,
  decideDoseOpen,
  doseOpenFailure,
  resolveDoseOpen,
  type DoseOpenContext,
} from '../src/lib/doseOpen';
import { responseData } from '../src/lib/pushCore';

const PAYLOAD = { tipo: 'DOSE_NAO_CONFIRMADA', doseId: '5000', pacienteId: '12', data: '2026-10-18' };
const ALVO = { doseId: '5000', patientId: '12', day: '2026-10-18' };
const CUIDADOR_LOGADO: DoseOpenContext = { viewAs: 'CAREGIVER', hasSession: true };

describe('toque no aviso de dose: payload até o destino', () => {
  it('payload válido com cuidador logado abre a dose (app aberto, em segundo plano ou fechado: mesma decisão)', () => {
    expect(resolveDoseOpen(PAYLOAD, CUIDADOR_LOGADO)).toEqual({ action: 'abrir-dose', target: ALVO });
    // O FCM manda texto, mas números também são aceitos
    expect(resolveDoseOpen({ ...PAYLOAD, doseId: 5000, pacienteId: 12 }, CUIDADOR_LOGADO)).toEqual({ action: 'abrir-dose', target: ALVO });
  });

  it.each([
    ['sem dados', null],
    ['texto solto', 'DOSE_NAO_CONFIRMADA'],
    ['objeto vazio', {}],
    ['sem doseId', { ...PAYLOAD, doseId: undefined }],
    ['sem pacienteId', { ...PAYLOAD, pacienteId: undefined }],
    ['sem data', { ...PAYLOAD, data: undefined }],
    ['data em outro formato', { ...PAYLOAD, data: '18/10/2026' }],
    ['id que não é número', { ...PAYLOAD, doseId: 'abc' }],
    ['tipo desconhecido', { ...PAYLOAD, tipo: 'MENSAGEM_NOVA' }],
    ['sem tipo', { ...PAYLOAD, tipo: undefined }],
  ])('payload inválido (%s) é ignorado sem quebrar', (_nome, payload) => {
    expect(resolveDoseOpen(payload, CUIDADOR_LOGADO)).toEqual({ action: 'ignorar' });
  });

  it('sem sessão de cuidador (expirada) o destino espera o login', () => {
    expect(resolveDoseOpen(PAYLOAD, { viewAs: 'CAREGIVER', hasSession: false })).toEqual({ action: 'aguardar-login', target: ALVO });
  });

  it('com o perfil do aparelho ainda não escolhido, o destino também espera o login do cuidador', () => {
    expect(resolveDoseOpen(PAYLOAD, { viewAs: null, hasSession: false })).toEqual({ action: 'aguardar-login', target: ALVO });
  });

  it('aparelho no perfil do paciente ignora o aviso (ele é só do cuidador)', () => {
    expect(resolveDoseOpen(PAYLOAD, { viewAs: 'PATIENT', hasSession: false })).toEqual({ action: 'ignorar' });
    expect(resolveDoseOpen(PAYLOAD, { viewAs: 'PATIENT', hasSession: true })).toEqual({ action: 'ignorar' });
  });

  it('paciente que não pertence à conta logada leva ao Painel com aviso', () => {
    expect(resolveDoseOpen(PAYLOAD, { ...CUIDADOR_LOGADO, knownPatientIds: ['7', '8'] })).toEqual({ action: 'painel', notice: FOREIGN_PATIENT_NOTICE });
    expect(resolveDoseOpen(PAYLOAD, { ...CUIDADOR_LOGADO, knownPatientIds: ['7', '12'] })).toEqual({ action: 'abrir-dose', target: ALVO });
  });

  it('decideDoseOpen aceita o destino já lido do payload', () => {
    expect(decideDoseOpen(ALVO, CUIDADOR_LOGADO)).toEqual({ action: 'abrir-dose', target: ALVO });
    expect(decideDoseOpen(null, CUIDADOR_LOGADO)).toEqual({ action: 'ignorar' });
  });
});

describe('dose aberta pelo aviso que não carrega', () => {
  it('dose inexistente (ou de paciente de outra conta: a API responde 404 igual) vira aviso com o caminho do Painel', () => {
    expect(doseOpenFailure({ status: 404, code: 'RECURSO_NAO_ENCONTRADO' })).toEqual({ notice: MISSING_DOSE_NOTICE });
    expect(doseOpenFailure({ status: 404 })).toEqual({ notice: MISSING_DOSE_NOTICE });
  });

  it('sem rede ou erro do servidor fica com a tela de erro e o "Tentar novamente"', () => {
    expect(doseOpenFailure({ status: 0, code: undefined })).toBeNull();
    expect(doseOpenFailure({ status: 500 })).toBeNull();
    expect(doseOpenFailure(null)).toBeNull();
    expect(doseOpenFailure(undefined)).toBeNull();
  });
});

describe('dados do push tocado', () => {
  it('lê content.data e, sem ele, trigger.remoteMessage.data', () => {
    expect(responseData({ notification: { request: { content: { data: PAYLOAD } } } })).toEqual(PAYLOAD);
    expect(responseData({ notification: { request: { content: { data: {} }, trigger: { remoteMessage: { data: PAYLOAD } } } } })).toEqual(PAYLOAD);
    expect(responseData({ notification: { request: { content: {} } } })).toEqual({});
    expect(responseData(null)).toEqual({});
    expect(responseData('lixo')).toEqual({});
  });
});
