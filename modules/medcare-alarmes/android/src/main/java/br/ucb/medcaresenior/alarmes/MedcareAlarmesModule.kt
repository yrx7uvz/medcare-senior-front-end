package br.ucb.medcaresenior.alarmes

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * O que o expo-notifications não expõe ao JavaScript e o lembrete de dose precisa saber:
 *
 * - se o aparelho deixa o app agendar alarme EXATO (Android 12+: "Alarmes e lembretes"). Sem isso, o
 *   expo-notifications agenda o lembrete como alarme inexato e o Android pode atrasá-lo em vários minutos;
 * - se o app está fora da otimização de bateria (Doze e as economias dos fabricantes adiam o que roda em segundo plano).
 *
 * E abre as telas certas das configurações para o paciente (ou o cuidador) liberar. Nada aqui pede permissão nova: a
 * tela de alarmes exatos é a do próprio Android, e a de bateria é a página do app nas configurações.
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
