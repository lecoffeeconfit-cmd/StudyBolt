package com.studybolt.backgroundplayback

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StudyBoltBackgroundPlaybackModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StudyBoltBackgroundPlayback")

    AsyncFunction("start") { title: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      val intent = Intent(context, StudyCastPlaybackService::class.java)
        .putExtra(StudyCastPlaybackService.EXTRA_TITLE, title)
      context.startForegroundService(intent)
      Unit
    }

    AsyncFunction("stop") {
      val context = appContext.reactContext ?: return@AsyncFunction
      context.stopService(Intent(context, StudyCastPlaybackService::class.java))
      Unit
    }
  }
}
