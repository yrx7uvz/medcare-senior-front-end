package br.ucb.medcaresenior.alarmes

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Disparo do AlarmManager e o botão "Adiar 5 minutos" da notificação. Só recebe do próprio app (não exportado). */
class ReceptorDeAlarme : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val doseId = intent.getStringExtra(AlarmesDaDose.EXTRA_DOSE) ?: return
    when (intent.action) {
      AlarmesDaDose.ACAO_DISPARAR -> AlarmesDaDose.disparar(context, doseId)
      AlarmesDaDose.ACAO_ADIAR -> AlarmesDaDose.adiar(context, doseId)
    }
  }
}

/**
 * Aparelho ligado de novo ou app atualizado: o Android apaga os alarmes do AlarmManager, e os gravados são programados
 * de novo. Exportado porque quem manda é o sistema; as duas ações são protegidas (nenhum app consegue enviá-las).
 */
class ReceptorDeInicio : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> AlarmesDaDose.reprogramarTodos(context)
    }
  }
}
