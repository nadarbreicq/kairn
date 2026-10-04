package app.kairn.location

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * Suivi GPS de la séance en cours : service au premier plan (notification
 * permanente) qui lit le GPS du système via LocationManager, sans Google
 * Play Services.
 *
 * Chaque position est d'abord ajoutée au journal de séance sur disque
 * (une ligne JSON par point, dans `points.jsonl`), puis transmise à
 * l'interface si elle écoute. Le service n'a donc pas besoin de
 * JavaScript pour sauvegarder la trace : si Android tue l'app, les points
 * continuent d'être écrits ; si Android tue aussi le service, il le
 * relance (START_STICKY) et le suivi reprend d'après la configuration
 * enregistrée.
 */
class TrackingService : Service(), LocationListener {

  private var journalFile: File? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    if (intent?.hasExtra(EXTRA_JOURNAL_DIR) == true) {
      prefs.edit()
        .putBoolean(KEY_ACTIVE, true)
        .putString(KEY_JOURNAL_DIR, intent.getStringExtra(EXTRA_JOURNAL_DIR))
        .putString(KEY_TITLE, intent.getStringExtra(EXTRA_TITLE))
        .putString(KEY_BODY, intent.getStringExtra(EXTRA_BODY))
        .putLong(KEY_INTERVAL, intent.getLongExtra(EXTRA_INTERVAL, 1000L))
        .apply()
    } else if (!prefs.getBoolean(KEY_ACTIVE, false)) {
      // Relancé par Android alors qu'aucune séance n'est en cours.
      stopSelf()
      return START_NOT_STICKY
    }

    val journalDir = prefs.getString(KEY_JOURNAL_DIR, null)
    journalFile = journalDir?.let { File(it.removePrefix("file://"), "points.jsonl") }

    val notification = buildNotification(
      prefs.getString(KEY_TITLE, null) ?: "Kairn enregistre votre séance",
      prefs.getString(KEY_BODY, null) ?: "Suivi GPS actif."
    )
    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      notification,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
    )

    if (!requestUpdates(prefs.getLong(KEY_INTERVAL, 1000L))) {
      stop(this)
      return START_NOT_STICKY
    }
    running = true
    return START_STICKY
  }

  @SuppressLint("MissingPermission")
  private fun requestUpdates(intervalMs: Long): Boolean {
    val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return try {
      manager.removeUpdates(this)
      manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, intervalMs, 0f, this, Looper.getMainLooper())
      true
    } catch (err: SecurityException) {
      Log.w(TAG, "Position refusée, suivi arrêté", err)
      false
    } catch (err: IllegalArgumentException) {
      Log.w(TAG, "GPS indisponible sur cet appareil", err)
      false
    }
  }

  override fun onLocationChanged(location: Location) {
    val sample = location.toSample()
    appendToJournal(sample)
    listener?.invoke(sample)
  }

  // Les lots de positions (écran éteint) arrivent un par un, dans l'ordre.
  override fun onLocationChanged(locations: MutableList<Location>) {
    locations.forEach { onLocationChanged(it) }
  }

  @Deprecated("Requis par les anciennes versions d'Android")
  override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
  override fun onProviderEnabled(provider: String) {}
  override fun onProviderDisabled(provider: String) {}

  private fun appendToJournal(sample: Map<String, Any>) {
    val file = journalFile ?: return
    // Le dossier n'existe plus une fois la séance terminée ou abandonnée :
    // une position tardive ne doit pas le recréer.
    if (file.parentFile?.isDirectory != true) return
    try {
      FileOutputStream(file, true).use { out ->
        out.write((JSONObject(sample).toString() + "\n").toByteArray(Charsets.UTF_8))
      }
    } catch (err: Exception) {
      Log.w(TAG, "Écriture du journal de séance impossible", err)
    }
  }

  private fun buildNotification(title: String, body: String): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Enregistrement en cours", NotificationManager.IMPORTANCE_LOW)
      )
    }
    val openApp = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.kairn_notification)
      .setColor(0xFF9184D9.toInt())
      .setContentTitle(title)
      .setContentText(body)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setContentIntent(openApp)
      .build()
  }

  override fun onDestroy() {
    (getSystemService(Context.LOCATION_SERVICE) as LocationManager).removeUpdates(this)
    running = false
    super.onDestroy()
  }

  companion object {
    private const val TAG = "KairnLocation"
    private const val PREFS = "kairn_tracking"
    private const val KEY_ACTIVE = "active"
    private const val KEY_JOURNAL_DIR = "journalDir"
    private const val KEY_TITLE = "title"
    private const val KEY_BODY = "body"
    private const val KEY_INTERVAL = "intervalMs"
    private const val CHANNEL_ID = "kairn-enregistrement"
    private const val NOTIFICATION_ID = 7333

    const val EXTRA_JOURNAL_DIR = "journalDir"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    const val EXTRA_INTERVAL = "intervalMs"

    /** Interface à l'écoute des positions, s'il y en a une. */
    @Volatile var listener: ((Map<String, Any>) -> Unit)? = null
    @Volatile var running = false
      private set

    /** Une séance est-elle en cours de suivi (y compris lancée avant que l'app ne soit tuée) ? */
    fun isActive(context: Context): Boolean =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ACTIVE, false)

    fun stop(context: Context) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, false).apply()
      context.stopService(Intent(context, TrackingService::class.java))
    }
  }
}

private fun Location.toSample(): Map<String, Any> {
  val sample = mutableMapOf<String, Any>("lat" to latitude, "lon" to longitude, "t" to time)
  if (hasAltitude()) sample["ele"] = altitude
  if (hasAccuracy()) sample["accuracy"] = accuracy.toDouble()
  return sample
}
