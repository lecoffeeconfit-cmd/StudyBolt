package com.studybolt.backgroundplayback

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class StudyCastPlaybackService : Service() {
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE)?.takeIf { it.isNotBlank() } ?: "StudyCast audio"
    ensureNotificationChannel()
    val notification = buildNotification(title)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, "StudyCast playback", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Keeps StudyCast listening active while StudyBolt is in the background."
      setShowBadge(false)
    }
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun buildNotification(title: String): Notification {
    val openIntent = packageManager.getLaunchIntentForPackage(packageName)?.let { launchIntent ->
      android.app.PendingIntent.getActivity(
        this,
        OPEN_REQUEST_CODE,
        launchIntent,
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE,
      )
    }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle("StudyCast is playing")
      .setContentText(title)
      .setSubText("StudyBolt")
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(openIntent)
      .build()
  }

  companion object {
    const val EXTRA_TITLE = "studycast_title"
    private const val CHANNEL_ID = "studycast-playback"
    private const val NOTIFICATION_ID = 7812
    private const val OPEN_REQUEST_CODE = 7814
  }
}
