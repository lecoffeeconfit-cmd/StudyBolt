package com.studybolt.ondeviceai

import android.os.Build
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StudyBoltOnDeviceAIModule : Module() {
  private val generativeModel by lazy { Generation.getClient() }

  override fun definition() = ModuleDefinition {
    Name("StudyBoltOnDeviceAI")

    AsyncFunction("getAvailability") Coroutine {
      currentAvailability()
    }

    AsyncFunction("downloadModel") Coroutine {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return@Coroutine unavailable("On-device tutoring requires Android 8 or later.")
      }

      if (generativeModel.checkStatus() == FeatureStatus.DOWNLOADABLE) {
        generativeModel.download().collect { status ->
          if (status is DownloadStatus.DownloadFailed) {
            throw OnDeviceAIException("Gemini Nano could not be downloaded.", status.e)
          }
        }
      }
      currentAvailability()
    }

    AsyncFunction("generate") Coroutine { prompt: String, instructions: String ->
      if (generativeModel.checkStatus() != FeatureStatus.AVAILABLE) {
        throw OnDeviceAIException("Gemini Nano is not ready on this phone.")
      }

      try {
        val boundedPrompt = buildString {
          append(instructions.take(2_000))
          append("\n\n")
          append(prompt.take(10_000))
        }
        val response = generativeModel.generateContent(boundedPrompt)
        val content = response.candidates.firstOrNull()?.text?.trim().orEmpty()
        if (content.isEmpty()) throw OnDeviceAIException("Gemini Nano returned an empty response.")
        mapOf(
          "text" to content.take(4_000),
          "provider" to "gemini-nano"
        )
      } catch (error: OnDeviceAIException) {
        throw error
      } catch (error: Throwable) {
        throw OnDeviceAIException("Gemini Nano could not answer that right now.", error)
      }
    }

    OnDestroy {
      generativeModel.close()
    }
  }

  private suspend fun currentAvailability(): Map<String, String> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return unavailable("On-device tutoring requires Android 8 or later.")
    }
    return when (generativeModel.checkStatus()) {
      FeatureStatus.AVAILABLE -> available("available", "Gemini Nano is ready on this device.")
      FeatureStatus.DOWNLOADABLE -> available("downloadable", "Gemini Nano can be downloaded for private, on-device tutoring.")
      FeatureStatus.DOWNLOADING -> available("downloading", "Gemini Nano is downloading on this device.")
      else -> unavailable("This Android phone does not currently support Gemini Nano Prompt API.")
    }
  }

  private fun available(status: String, reason: String) = mapOf(
    "status" to status,
    "provider" to "gemini-nano",
    "reason" to reason
  )

  private fun unavailable(reason: String) = available("unavailable", reason)
}

private class OnDeviceAIException(
  message: String,
  cause: Throwable? = null
) : CodedException(message, cause)
