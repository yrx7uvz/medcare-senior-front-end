package br.ucb.medcaresenior.alarmes

import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Tela do alarme, aberta pela notificação (tela cheia com o celular bloqueado ou apagado, ou um toque nela). Letras
 * grandes e dois botões: "Tomar o remédio" (cala por 3 minutos, desbloqueia e abre o app na dose para confirmar) e
 * "Adiar 5 minutos". Voltar fecha só a tela: o alarme continua até a confirmação.
 */
class AlarmeActivity : Activity() {
  private var doseId: String? = null
  private var ouvindo = false

  private val fechar = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.getStringExtra(AlarmesDaDose.EXTRA_DOSE) == doseId) finish()
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    mostrarPorCimaDoBloqueio()
    val filtro = IntentFilter(AlarmesDaDose.ACAO_FECHAR_TELA)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(fechar, filtro, Context.RECEIVER_NOT_EXPORTED)
    } else {
      registerReceiver(fechar, filtro)
    }
    ouvindo = true
    abrir(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    abrir(intent)
  }

  override fun onDestroy() {
    if (ouvindo) unregisterReceiver(fechar)
    ouvindo = false
    super.onDestroy()
  }

  private fun abrir(intent: Intent) {
    val id = intent.getStringExtra(AlarmesDaDose.EXTRA_DOSE)
    val alarme = id?.let { ArmazemDeAlarmes.obter(this, it) }
    if (id == null || alarme == null) {
      // Dose já confirmada ou alarme encerrado: nada a mostrar
      finish()
      return
    }
    doseId = id
    montarTela(alarme)
    if (intent.action == AlarmesDaDose.ACAO_TOMAR) tomar()
  }

  private fun tomar() {
    val id = doseId ?: return finish()
    if (AlarmesDaDose.tomar(this, id) == null) return finish()
    val bloqueio = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
    if (bloqueio != null && bloqueio.isKeyguardLocked) {
      // Pede o desbloqueio (PIN, digital) e só então abre o app; se o paciente desistir, a tela do alarme continua
      bloqueio.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
        override fun onDismissSucceeded() = abrirApp()
      })
    } else {
      abrirApp()
    }
  }

  private fun adiar() {
    doseId?.let { AlarmesDaDose.adiar(this, it) }
    finish()
  }

  private fun abrirApp() {
    packageManager.getLaunchIntentForPackage(packageName)?.let { app ->
      app.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      startActivity(app)
    }
    finish()
  }

  private fun mostrarPorCimaDoBloqueio() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  // ---------------------------------------------------------------- tela (sem XML: só código, cores do app)

  private fun dp(valor: Int) = (valor * resources.displayMetrics.density).toInt()

  private fun montarTela(alarme: AlarmeDeDose) {
    val escuro = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    val fundo = Color.parseColor(if (escuro) "#121417" else "#F0F4F8")
    val texto = Color.parseColor(if (escuro) "#F2F4F7" else "#1B1F24")
    val textoFraco = Color.parseColor(if (escuro) "#B8C0CC" else "#4A5562")
    val primaria = Color.parseColor(if (escuro) "#5AA9E6" else "#1A6FB5")
    val sobrePrimaria = Color.parseColor(if (escuro) "#0B1620" else "#FFFFFF")
    // A tela vai de borda a borda (Android 15+): o fundo cobre as barras, e os ícones delas seguem o tema
    if (!escuro && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      @Suppress("DEPRECATION")
      window.decorView.systemUiVisibility =
        View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
    }

    fun rotulo(conteudo: String, tamanhoSp: Float, cor: Int, negrito: Boolean = false) = TextView(this).apply {
      text = conteudo
      setTextColor(cor)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, tamanhoSp)
      gravity = Gravity.CENTER
      if (negrito) setTypeface(typeface, Typeface.BOLD)
      setPadding(0, dp(8), 0, dp(8))
    }

    fun botao(conteudo: String, cheio: Boolean, acao: () -> Unit) = Button(this).apply {
      text = conteudo
      isAllCaps = false
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
      setTypeface(typeface, Typeface.BOLD)
      setTextColor(if (cheio) sobrePrimaria else primaria)
      minHeight = dp(72)
      stateListAnimator = null
      background = GradientDrawable().apply {
        cornerRadius = dp(16).toFloat()
        if (cheio) setColor(primaria) else {
          setColor(Color.TRANSPARENT)
          setStroke(dp(2), primaria)
        }
      }
      setOnClickListener { acao() }
      layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        .apply { topMargin = dp(16) }
    }

    val tela = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(fundo)
      setPadding(dp(24), dp(48), dp(24), dp(48))
      addView(rotulo("⏰", 64f, texto))
      addView(rotulo(alarme.titulo, 34f, texto, negrito = true))
      addView(rotulo(alarme.corpo, 26f, texto))
      addView(rotulo("O alarme só para quando você confirmar o remédio.", 18f, textoFraco))
      addView(botao("Tomar o remédio", cheio = true) { tomar() }.apply { contentDescription = "Tomar o remédio e confirmar no app" })
      addView(botao("Adiar 5 minutos", cheio = false) { adiar() })
    }
    setContentView(tela)
  }
}
