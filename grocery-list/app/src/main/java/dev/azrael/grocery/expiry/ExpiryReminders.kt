package dev.azrael.grocery.expiry

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.azrael.grocery.GroceryApp
import dev.azrael.grocery.MainActivity
import dev.azrael.grocery.R
import dev.azrael.grocery.parse.Expiry
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.util.concurrent.TimeUnit

/** Once a day, around [REMIND_AT], a notification lists Cabinet items that are expired or expire within two days. */
object ExpiryReminders {
    private const val WORK_NAME = "cabinet-expiry-reminder"
    private const val CHANNEL_ID = "cabinet-expiry"
    private const val NOTIFICATION_ID = 1001
    val REMIND_AT: LocalTime = LocalTime.of(9, 0)

    /** Extra on the notification's tap intent; MainActivity opens the Cabinet when it's set. */
    const val EXTRA_OPEN_CABINET = "dev.azrael.grocery.OPEN_CABINET"

    /** Safe to call on every launch: an existing schedule is kept. */
    fun schedule(context: Context) {
        val now = LocalDateTime.now()
        var next = now.toLocalDate().atTime(REMIND_AT)
        if (!next.isAfter(now)) next = next.plusDays(1)
        val request = PeriodicWorkRequestBuilder<ExpiryWorker>(1, TimeUnit.DAYS)
            .setInitialDelay(Duration.between(now, next).toMillis(), TimeUnit.MILLISECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    /** Android 13+ asks before an app can post notifications; earlier versions allow it by default. */
    fun needsPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED

    internal suspend fun remind(context: Context) {
        val repo = (context.applicationContext as GroceryApp).repository
        val today = LocalDate.now()
        val due = Expiry.dueSoon(
            repo.cabinetWithExpiry().mapNotNull { item -> item.expiresOn?.let { Expiry.Due(item.name, it) } },
            today,
        )
        val manager = NotificationManagerCompat.from(context)
        val (title, body) = Expiry.reminderText(due, today) ?: run {
            manager.cancel(NOTIFICATION_ID)
            return
        }
        if (needsPermission(context) || !manager.areNotificationsEnabled()) return
        ensureChannel(context)

        val open = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(EXTRA_OPEN_CABINET, true)
        val tap = PendingIntent.getActivity(
            context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(tap)
            .setAutoCancel(true)
            .build()
        try {
            manager.notify(NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {
            // Permission was revoked between the check and the post.
        }
    }

    private fun ensureChannel(context: Context) {
        val channel = NotificationChannel(CHANNEL_ID, "Cabinet expiry reminders", NotificationManager.IMPORTANCE_DEFAULT)
            .apply { description = "A daily note about Cabinet items that expire soon" }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}

class ExpiryWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        ExpiryReminders.remind(applicationContext)
        return Result.success()
    }
}
