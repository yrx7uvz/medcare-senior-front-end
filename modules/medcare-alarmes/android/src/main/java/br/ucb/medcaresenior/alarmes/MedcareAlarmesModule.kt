package br.ucb.medcaresenior.alarmes

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

/**
 * O que o expo-notifications não expõe ao JavaScript e o lembrete de dose precisa saber:
 *
 * - se o aparelho deixa o app agendar alarme EXATO (Android 12+: "Alarmes e lembretes"). Sem isso, o
 *   expo-notifications agenda o lembrete como alarme inexato e o Android pode atrasá-lo em vários minutos;
 * - se o app está fora da otimização de bateria (Doze e as economias dos fabricantes adiam o que roda em segundo plano).
 *
 * E abre as telas certas das configurações para o paciente (ou o cuidador) liberar: a tela de alarmes exatos é a do
 * próprio Android, e a de bateria é a página do app nas configurações.
 *
 * Também é a porta do alarme da dose (AlarmesDaDose): o app manda os alarmes das próximas doses, cancela o da dose
 * confirmada e busca a dose que o paciente pediu para confirmar na tela do alarme.
 */
class MedcareAlarmesModule : Module() {
  private val context: Context?
    get() = appContext.reactContext

  override fun definition() = ModuleDefinition {
    Name("MedcareAlarmes")

    // Antes do Android 12 todo app agenda alarme exato sem pedir
    Function("podeAgendarAlarmeExato") {
      val ctx = context ?: return@Function true
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function true
      val alarmes = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return@Function true
      alarmes.canScheduleExactAlarms()
    }

    Function("ignoraOtimizacaoDeBateria") {
      val ctx = context ?: return@Function false
      val energia = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return@Function false
      energia.isIgnoringBatteryOptimizations(ctx.packageName)
    }

    // "Alarmes e lembretes" deste app (Android 12+). Antes disso não existe a tela: abre a página do app
    Function("abrirAjusteDeAlarmeExato") {
      val ctx = context ?: return@Function false
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + ctx.packageName))
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName))
      }
      abrir(ctx, intent)
    }

    // Página do app nas configurações, onde fica "Bateria" -> "Sem restrições"; se não abrir, a lista de otimização
    Function("abrirAjusteDeBateria") {
      val ctx = context ?: return@Function false
      abrir(ctx, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName))) ||
        abrir(ctx, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    // -1: não deu para gravar (sem contexto ou lista ilegível); o app volta para os lembretes comuns
    Function("agendarAlarmes") { json: String, forcar: Boolean ->
      val ctx = context ?: return@Function -1
      val lista = try {
        JSONArray(json)
      } catch (e: Exception) {
        return@Function -1
      }
      val alarmes = (0 until lista.length()).mapNotNull { AlarmeDeDose.deJson(lista.getJSONObject(it)) }
      AlarmesDaDose.agendar(ctx, alarmes, forcar)
    }

    Function("listarAlarmes") {
      val ctx = context ?: return@Function emptyList<String>()
      ArmazemDeAlarmes.todos(ctx).keys.toList()
    }

    Function("cancelarAlarme") { doseId: String ->
      context?.let { AlarmesDaDose.cancelar(it, doseId) }
      Unit
    }

    Function("cancelarTodosOsAlarmes") {
      context?.let { AlarmesDaDose.cancelarTodos(it) }
      Unit
    }

    Function("tomarAberturaPendente") {
      val ctx = context ?: return@Function null
      ArmazemDeAlarmes.tomarAbertura(ctx)
    }

    // Android 14+: o paciente pode tirar do app a tela cheia por cima do bloqueio. Antes disso, sempre pode
    Function("podeUsarTelaCheia") {
      val ctx = context ?: return@Function true
      if (Build.VERSION.SDK_INT < 34) return@Function true
      val gerente = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return@Function true
      gerente.canUseFullScreenIntent()
    }

    Function("abrirAjusteDeTelaCheia") {
      val ctx = context ?: return@Function false
      if (Build.VERSION.SDK_INT >= 34) {
        abrir(ctx, Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + ctx.packageName))) ||
          abrir(ctx, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName)))
      } else {
        abrir(ctx, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName)))
      }
    }
  }

  private fun abrir(ctx: Context, intent: Intent): Boolean {
    return try {
      ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    } catch (e: Exception) {
      false
    }
  }
}
