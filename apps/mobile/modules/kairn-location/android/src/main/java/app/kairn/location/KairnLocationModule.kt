package app.kairn.location

import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class StartOptions : Record {
  /** Dossier du journal de séance (URI file:// des documents de l'app). */
  @Field val journalDir: String = ""
  @Field val intervalMs: Double = 1000.0
  @Field val notificationTitle: String = "Kairn enregistre votre séance"
  @Field val notificationBody: String = "Suivi GPS actif."
}

/** Pont JavaScript du suivi GPS — voir TrackingService. */
class KairnLocationModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("KairnLocation")
    Events("onLocation")

    OnStartObserving {
      TrackingService.listener = { sample -> sendEvent("onLocation", sample) }
    }
    OnStopObserving {
      TrackingService.listener = null
    }

    AsyncFunction("start") { options: StartOptions ->
      val intent = Intent(context, TrackingService::class.java)
        .putExtra(TrackingService.EXTRA_JOURNAL_DIR, options.journalDir)
        .putExtra(TrackingService.EXTRA_INTERVAL, options.intervalMs.toLong())
        .putExtra(TrackingService.EXTRA_TITLE, options.notificationTitle)
        .putExtra(TrackingService.EXTRA_BODY, options.notificationBody)
      ContextCompat.startForegroundService(context, intent)
    }

    Function("stop") {
      TrackingService.stop(context)
    }

    Function("isActive") {
      TrackingService.isActive(context)
    }
  }
}
