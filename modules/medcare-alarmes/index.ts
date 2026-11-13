import { requireOptionalNativeModule } from 'expo';

/**
 * Módulo nativo local (android/): alarme exato e otimização de bateria do Android, que o expo-notifications não expõe.
 * Opcional: no Expo Go, na web e nos testes ele não existe e o resultado é null (quem chama trata como "não sei").
 */
export interface MedcareAlarmesNativo {
  podeAgendarAlarmeExato(): boolean;
  ignoraOtimizacaoDeBateria(): boolean;
  abrirAjusteDeAlarmeExato(): boolean;
  abrirAjusteDeBateria(): boolean;
}

export const medcareAlarmes = requireOptionalNativeModule<MedcareAlarmesNativo>('MedcareAlarmes');
