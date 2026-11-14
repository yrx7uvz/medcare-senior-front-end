package br.ucb.medcaresenior.alarmes

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Um alarme de dose gravado no aparelho. Os instantes são do relógio do APARELHO (o app já converteu do relógio do
 * servidor), em milissegundos.
 *
 * @property disparoMs horário da dose: quando o alarme toca pela primeira vez
 * @property ateMs     prazo de confirmação: depois disso a dose não pode mais ser confirmada e o alarme some
 * @property proximoMs quando o alarme toca de novo (primeiro toque, repetição enquanto não confirma ou fim da soneca)
 */
data class AlarmeDeDose(
  val doseId: String,
  val pacienteId: String,
  val data: String,
  val titulo: String,
  val corpo: String,
  val disparoMs: Long,
  val ateMs: Long,
  val proximoMs: Long,
) {
  fun paraJson(): JSONObject = JSONObject()
    .put("doseId", doseId)
    .put("pacienteId", pacienteId)
    .put("data", data)
    .put("titulo", titulo)
    .put("corpo", corpo)
    .put("disparoMs", disparoMs)
    .put("ateMs", ateMs)
    .put("proximoMs", proximoMs)

  companion object {
    /** Lê um alarme vindo do app ou do armazenamento; inválido vira null (nunca derruba o app). */
    fun deJson(json: JSONObject): AlarmeDeDose? {
      return try {
        val doseId = json.getString("doseId")
        if (doseId.isBlank()) return null
        val disparo = json.getLong("disparoMs")
        AlarmeDeDose(
          doseId = doseId,
          pacienteId = json.optString("pacienteId", ""),
          data = json.optString("data", ""),
          titulo = json.optString("titulo", "Hora do remédio"),
          corpo = json.optString("corpo", ""),
          disparoMs = disparo,
          ateMs = json.getLong("ateMs"),
          proximoMs = json.optLong("proximoMs", disparo),
        )
      } catch (e: Exception) {
        null
      }
    }
  }
}

/**
 * Alarmes gravados (SharedPreferences, só deste app): sobrevivem ao app fechado e ao reinício do aparelho, quando o
 * AlarmManager esquece tudo e o ReceptorDeInicio programa de novo. Também guarda a dose que o paciente pediu para
 * confirmar na tela do alarme, até o app abrir e buscá-la.
 */
object ArmazemDeAlarmes {
  private const val ARQUIVO = "medcare_alarmes_da_dose"
  private const val CHAVE_ALARMES = "alarmes"
  private const val CHAVE_ABERTURA = "abertura"
  /** Abertura mais velha que isso é ignorada (o paciente desistiu de abrir o app). */
  private const val VALIDADE_DA_ABERTURA_MS = 15 * 60_000L

  private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(ARQUIVO, Context.MODE_PRIVATE)

  @Synchronized
  fun todos(ctx: Context): Map<String, AlarmeDeDose> {
    val texto = prefs(ctx).getString(CHAVE_ALARMES, null) ?: return emptyMap()
    return try {
      val lista = JSONArray(texto)
      (0 until lista.length())
        .mapNotNull { AlarmeDeDose.deJson(lista.getJSONObject(it)) }
        .associateBy { it.doseId }
    } catch (e: Exception) {
      emptyMap()
    }
  }

  @Synchronized
  fun obter(ctx: Context, doseId: String): AlarmeDeDose? = todos(ctx)[doseId]

  @Synchronized
  fun salvar(ctx: Context, alarme: AlarmeDeDose) {
    gravar(ctx, todos(ctx) + (alarme.doseId to alarme))
  }

  @Synchronized
  fun remover(ctx: Context, doseId: String) {
    gravar(ctx, todos(ctx) - doseId)
  }

  @Synchronized
  fun removerTodos(ctx: Context) {
    prefs(ctx).edit().remove(CHAVE_ALARMES).apply()
  }

  private fun gravar(ctx: Context, alarmes: Map<String, AlarmeDeDose>) {
    val lista = JSONArray()
    alarmes.values.forEach { lista.put(it.paraJson()) }
    prefs(ctx).edit().putString(CHAVE_ALARMES, lista.toString()).apply()
  }

  @Synchronized
  fun salvarAbertura(ctx: Context, alarme: AlarmeDeDose) {
    val abertura = JSONObject()
      .put("doseId", alarme.doseId)
      .put("pacienteId", alarme.pacienteId)
      .put("data", alarme.data)
      .put("em", System.currentTimeMillis())
    prefs(ctx).edit().putString(CHAVE_ABERTURA, abertura.toString()).apply()
  }

  /** A abertura pendente, uma vez só: devolve e apaga. */
  @Synchronized
  fun tomarAbertura(ctx: Context): String? {
    val texto = prefs(ctx).getString(CHAVE_ABERTURA, null) ?: return null
    prefs(ctx).edit().remove(CHAVE_ABERTURA).apply()
    return try {
      val json = JSONObject(texto)
      if (System.currentTimeMillis() - json.optLong("em", 0) > VALIDADE_DA_ABERTURA_MS) return null
      json.remove("em")
      json.toString()
    } catch (e: Exception) {
      null
    }
  }
}
