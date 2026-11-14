import { requireOptionalNativeModule } from 'expo';

/**
 * Módulo nativo local (android/): alarme exato, otimização de bateria e o alarme da dose do paciente, que o
 * expo-notifications não expõe. Opcional: no Expo Go, na web e nos testes ele não existe e o resultado é null (quem
 * chama trata como "não sei"). Um APK antigo pode ter o módulo sem as funções do alarme: confira antes de usar
 * (doseAlarm.ts faz isso).
 */
export interface MedcareAlarmesNativo {
  podeAgendarAlarmeExato(): boolean;
  ignoraOtimizacaoDeBateria(): boolean;
  abrirAjusteDeAlarmeExato(): boolean;
  abrirAjusteDeBateria(): boolean;

  /**
   * Alarme da dose: grava e programa cada alarme (lista em JSON, ver AlarmeDeDose em src/lib/doseAlarm.ts). Um alarme
   * que já existe com o mesmo horário mantém o estado (tocando, adiado); `forcar` programa de novo até esses.
   * @return quantos foram programados
   */
  agendarAlarmes?(json: string, forcar: boolean): number;
  /** Doses com alarme gravado (agendado, tocando ou adiado). */
  listarAlarmes?(): string[];
  /** Dose confirmada: o alarme para, sai da tela e não volta. */
  cancelarAlarme?(doseId: string): void;
  cancelarTodosOsAlarmes?(): void;
  /** Dose que o paciente pediu para confirmar na tela do alarme (JSON com doseId, pacienteId e data), uma vez só. */
  tomarAberturaPendente?(): string | null;
  /** Android 14+: o app pode abrir o alarme por cima da tela bloqueada. Antes disso, sempre. */
  podeUsarTelaCheia?(): boolean;
  abrirAjusteDeTelaCheia?(): boolean;
}

export const medcareAlarmes = requireOptionalNativeModule<MedcareAlarmesNativo>('MedcareAlarmes');
