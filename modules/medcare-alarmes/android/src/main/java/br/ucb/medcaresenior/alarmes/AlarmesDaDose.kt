package br.ucb.medcaresenior.alarmes

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Alarme da dose do paciente: toca no horário da dose e só para quando a dose é confirmada no app (ou quando o prazo de
 * confirmação acaba). O paciente pode adiar 5 minutos.
 *
 * Como toca:
 * - AlarmManager.setAlarmClock: o Android trata como despertador (não é adiado pela economia de bateria nem pelo Doze).
 *   Sem a liberação de alarme exato (Android 12+), cai para um alarme inexato, que pode atrasar;
 * - notificação no canal "Alarme do remédio": som de ALARME em repetição contínua (FLAG_INSISTENT), vibração, fixa
 *   (não sai deslizando) e com tela cheia: com o celular bloqueado ou apagado, a tela acende e abre a AlarmeActivity;
 * - enquanto não for confirmada, a dose toca de novo a cada 2 minutos (mesmo que o paciente tenha aberto a gaveta de
 *   notificações, o que cala o som insistente).
 *
 * "Tomar o remédio" cala o alarme por 3 minutos e abre o app na dose; se o paciente não confirmar, volta a tocar. "Adiar
 * 5 minutos" cala e tira a notificação até lá. Quem para o alarme de vez é o app, ao confirmar (cancelar).
 */
object AlarmesDaDose {
  const val CANAL = "alarme-dose"
  const val CANAL_SILENCIOSO = "alarme-dose-silencioso"

  const val ACAO_DISPARAR = "br.ucb.medcaresenior.alarmes.DISPARAR"
  const val ACAO_ADIAR = "br.ucb.medcaresenior.alarmes.ADIAR"
  const val ACAO_TOMAR = "br.ucb.medcaresenior.alarmes.TOMAR"
  const val ACAO_FECHAR_TELA = "br.ucb.medcaresenior.alarmes.FECHAR_TELA"
  const val EXTRA_DOSE = "doseId"

  const val REPETIR_MS = 2 * 60_000L
  const val ADIAR_MS = 5 * 60_000L
  const val TEMPO_PARA_CONFIRMAR_MS = 3 * 60_000L

  private const val ID_NOTIFICACAO = 7031
  private val COR = Color.parseColor("#1A6FB5")
  private val VIBRACAO = longArrayOf(0, 800, 400, 800, 400, 800)

  private fun tag(doseId: String) = "alarme-dose-$doseId"
  private fun uri(doseId: String) = Uri.parse("medcare-alarme://dose/" + Uri.encode(doseId))
  private fun flags() = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

  // ---------------------------------------------------------------- pedidos do app

  /** Grava e programa os alarmes vindos do app. Mesmo horário: mantém o estado (tocando, adiado, esperando). */
  fun agendar(ctx: Context, novos: List<AlarmeDeDose>, forcar: Boolean): Int {
    garantirCanais(ctx)
    var programados = 0
    for (novo in novos) {
      val atual = ArmazemDeAlarmes.obter(ctx, novo.doseId)
      if (atual != null && atual.disparoMs == novo.disparoMs) {
        // Nome do remédio ou prazo podem ter mudado (tolerância): atualiza sem mexer em quando toca
        val atualizado = novo.copy(proximoMs = atual.proximoMs)
        ArmazemDeAlarmes.salvar(ctx, atualizado)
        if (forcar) {
          programar(ctx, atualizado)
          programados++
        }
        continue
      }
      // Novo, ou o horário da dose mudou: começa do zero
      if (atual != null) removerNotificacao(ctx, novo.doseId)
      val alarme = novo.copy(proximoMs = novo.disparoMs)
      ArmazemDeAlarmes.salvar(ctx, alarme)
      programar(ctx, alarme)
      programados++
    }
    return programados
  }

  fun cancelar(ctx: Context, doseId: String) {
    ArmazemDeAlarmes.remover(ctx, doseId)
    desprogramar(ctx, doseId)
    removerNotificacao(ctx, doseId)
    fecharTela(ctx, doseId)
  }

  fun cancelarTodos(ctx: Context) {
    ArmazemDeAlarmes.todos(ctx).keys.forEach { cancelar(ctx, it) }
    ArmazemDeAlarmes.removerTodos(ctx)
  }

  // ---------------------------------------------------------------- eventos do Android

  /** Hora de tocar (primeira vez, repetição ou fim da soneca). Passado o prazo, o alarme some. */
  fun disparar(ctx: Context, doseId: String) {
    val alarme = ArmazemDeAlarmes.obter(ctx, doseId)
    if (alarme == null) {
      removerNotificacao(ctx, doseId)
      return
    }
    val agora = System.currentTimeMillis()
    if (agora >= alarme.ateMs) {
      cancelar(ctx, doseId)
      return
    }
    notificar(ctx, alarme, comSom = true)
    reprogramar(ctx, alarme, minOf(agora + REPETIR_MS, alarme.ateMs))
  }

  /** Soneca: cala agora e toca de novo daqui a 5 minutos (se ainda der para confirmar). */
  fun adiar(ctx: Context, doseId: String) {
    val alarme = ArmazemDeAlarmes.obter(ctx, doseId) ?: return removerNotificacao(ctx, doseId)
    removerNotificacao(ctx, doseId)
    fecharTela(ctx, doseId)
    reprogramar(ctx, alarme, minOf(System.currentTimeMillis() + ADIAR_MS, alarme.ateMs))
  }

  /**
   * O paciente vai confirmar: cala (a notificação fica, em silêncio, lembrando que falta confirmar), guarda a dose para
   * o app abrir e dá 3 minutos antes de tocar de novo.
   */
  fun tomar(ctx: Context, doseId: String): AlarmeDeDose? {
    val alarme = ArmazemDeAlarmes.obter(ctx, doseId) ?: return null
    val volta = minOf(System.currentTimeMillis() + TEMPO_PARA_CONFIRMAR_MS, alarme.ateMs)
    val reprogramado = reprogramar(ctx, alarme, volta)
    notificar(ctx, reprogramado, comSom = false)
    ArmazemDeAlarmes.salvarAbertura(ctx, alarme)
    return reprogramado
  }

  /** Aparelho reiniciado ou app atualizado: o AlarmManager esqueceu tudo. Atrasado e ainda no prazo toca já. */
  fun reprogramarTodos(ctx: Context) {
    garantirCanais(ctx)
    val agora = System.currentTimeMillis()
    for (alarme in ArmazemDeAlarmes.todos(ctx).values) {
      if (agora >= alarme.ateMs) ArmazemDeAlarmes.remover(ctx, alarme.doseId) else programar(ctx, alarme)
    }
  }

  // ---------------------------------------------------------------- AlarmManager

  private fun reprogramar(ctx: Context, alarme: AlarmeDeDose, quando: Long): AlarmeDeDose {
    val novo = alarme.copy(proximoMs = quando)
    ArmazemDeAlarmes.salvar(ctx, novo)
    programar(ctx, novo)
    return novo
  }

  private fun intentDeDisparo(ctx: Context, doseId: String): PendingIntent {
    val intent = Intent(ctx, ReceptorDeAlarme::class.java)
      .setAction(ACAO_DISPARAR)
      .setData(uri(doseId))
      .putExtra(EXTRA_DOSE, doseId)
    return PendingIntent.getBroadcast(ctx, 0, intent, flags())
  }

  private fun programar(ctx: Context, alarme: AlarmeDeDose) {
    val gerente = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val disparo = intentDeDisparo(ctx, alarme.doseId)
    val exato = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || gerente.canScheduleExactAlarms()
    try {
      if (exato) {
        gerente.setAlarmClock(AlarmManager.AlarmClockInfo(alarme.proximoMs, intentDaTela(ctx, alarme.doseId, null)), disparo)
        return
      }
    } catch (e: SecurityException) {
      // A liberação de alarme exato foi retirada entre a conferência e o pedido: segue como inexato
    }
    gerente.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarme.proximoMs, disparo)
  }

  private fun desprogramar(ctx: Context, doseId: String) {
    val gerente = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val disparo = intentDeDisparo(ctx, doseId)
    gerente.cancel(disparo)
    disparo.cancel()
  }

  // ---------------------------------------------------------------- notificação

  fun garantirCanais(ctx: Context) {
    val gerente = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    if (gerente.getNotificationChannel(CANAL) == null) {
      val som = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      val canal = NotificationChannel(CANAL, "Alarme do remédio", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Toca sem parar na hora do remédio, até você confirmar a dose no app."
        // Volume de alarme (o idoso costuma deixar alto), passa pelo modo silencioso de toque
        setSound(
          som,
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        enableVibration(true)
        vibrationPattern = VIBRACAO
        enableLights(true)
        lightColor = COR
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setShowBadge(false)
      }
      gerente.createNotificationChannel(canal)
    }
    if (gerente.getNotificationChannel(CANAL_SILENCIOSO) == null) {
      val canal = NotificationChannel(CANAL_SILENCIOSO, "Remédio esperando confirmação", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Fica na tela, sem som, enquanto você confirma o remédio no app."
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setShowBadge(false)
      }
      gerente.createNotificationChannel(canal)
    }
  }

  /** Tela do alarme. `acao` = ACAO_TOMAR: a tela já segue para confirmar (botão da notificação). */
  fun intentDaTela(ctx: Context, doseId: String, acao: String?): PendingIntent {
    val intent = Intent(ctx, AlarmeActivity::class.java)
      .setAction(acao ?: Intent.ACTION_VIEW)
      .setData(uri(doseId))
      .putExtra(EXTRA_DOSE, doseId)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
    return PendingIntent.getActivity(ctx, 0, intent, flags())
  }

  private fun intentDeAdiar(ctx: Context, doseId: String): PendingIntent {
    val intent = Intent(ctx, ReceptorDeAlarme::class.java)
      .setAction(ACAO_ADIAR)
      .setData(uri(doseId))
      .putExtra(EXTRA_DOSE, doseId)
    return PendingIntent.getBroadcast(ctx, 0, intent, flags())
  }

  private fun notificar(ctx: Context, alarme: AlarmeDeDose, comSom: Boolean) {
    garantirCanais(ctx)
    val gerente = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    val tela = intentDaTela(ctx, alarme.doseId, null)
    val icone = Icon.createWithResource(ctx, android.R.drawable.ic_lock_idle_alarm)
    val texto = if (comSom) {
      alarme.corpo
    } else {
      "${alarme.corpo}. Confirme no app: o alarme volta a tocar às ${hora(alarme.proximoMs)}."
    }
    val construtor = Notification.Builder(ctx, if (comSom) CANAL else CANAL_SILENCIOSO)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setColor(COR)
      .setContentTitle(alarme.titulo)
      .setContentText(texto)
      .setStyle(Notification.BigTextStyle().bigText(texto))
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setShowWhen(true)
      .setWhen(alarme.disparoMs)
      .setContentIntent(tela)
      .addAction(Notification.Action.Builder(icone, "Adiar 5 minutos", intentDeAdiar(ctx, alarme.doseId)).build())
      .addAction(Notification.Action.Builder(icone, "Tomar o remédio", intentDaTela(ctx, alarme.doseId, ACAO_TOMAR)).build())
    if (comSom) construtor.setFullScreenIntent(tela, true)
    val notificacao = construtor.build()
    if (comSom) notificacao.flags = notificacao.flags or Notification.FLAG_INSISTENT
    try {
      gerente.notify(tag(alarme.doseId), ID_NOTIFICACAO, notificacao)
    } catch (e: SecurityException) {
      // Notificações negadas (Android 13+): o app já mostra o aviso para o paciente ativar
    }
  }

  private fun removerNotificacao(ctx: Context, doseId: String) {
    val gerente = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    gerente.cancel(tag(doseId), ID_NOTIFICACAO)
  }

  /** Avisa a tela do alarme aberta (se houver) que esta dose não toca mais agora. */
  private fun fecharTela(ctx: Context, doseId: String) {
    ctx.sendBroadcast(Intent(ACAO_FECHAR_TELA).setPackage(ctx.packageName).putExtra(EXTRA_DOSE, doseId))
  }

  fun hora(ms: Long): String = SimpleDateFormat("HH:mm", Locale.forLanguageTag("pt-BR")).format(Date(ms))
}
