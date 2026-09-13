import ExpoModulesCore
import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

public final class StudyBoltOnDeviceAIModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StudyBoltOnDeviceAI")

    AsyncFunction("getAvailability") {
      return currentAvailability()
    }

    AsyncFunction("downloadModel") {
      // Apple manages the Foundation Model download at the system level.
      return currentAvailability()
    }

    AsyncFunction("generate") { (prompt: String, instructions: String, promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        let model = SystemLanguageModel.default
        guard model.isAvailable else {
          promise.reject(OnDeviceAIUnavailableException())
          return
        }

        let boundedInstructions = String(instructions.prefix(2_000))
        let boundedPrompt = String(prompt.prefix(10_000))
        Task {
          do {
            let session = LanguageModelSession(model: model) {
              boundedInstructions
            }
            let response = try await session.respond(to: boundedPrompt)
            let content = response.content.trimmingCharacters(in: .whitespacesAndNewlines)

            guard !content.isEmpty else {
              promise.reject(EmptyOnDeviceAIResponseException())
              return
            }

            promise.resolve([
              "text": String(content.prefix(4_000)),
              "provider": "apple-intelligence"
            ])
          } catch {
            promise.reject(error)
          }
        }
        return
      }
      #endif

      promise.reject(OnDeviceAIUnavailableException())
    }
  }

  private func currentAvailability() -> [String: String] {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      switch SystemLanguageModel.default.availability {
      case .available:
        return availability("available", reason: "Apple Intelligence is ready on this device.")
      case .unavailable(.appleIntelligenceNotEnabled):
        return availability("unavailable", reason: "Turn on Apple Intelligence in Settings to use on-device tutoring.")
      case .unavailable(.deviceNotEligible):
        return availability("unavailable", reason: "This iPhone does not support Apple Intelligence.")
      case .unavailable(.modelNotReady):
        return availability("downloading", reason: "Apple Intelligence is preparing its on-device model.")
      @unknown default:
        return availability("unavailable", reason: "Apple Intelligence is not available right now.")
      }
    }
    #endif

    return availability("unavailable", reason: "On-device tutoring requires iOS 26 or later and a supported iPhone.")
  }

  private func availability(_ status: String, reason: String) -> [String: String] {
    [
      "status": status,
      "provider": "apple-intelligence",
      "reason": reason
    ]
  }
}

internal final class OnDeviceAIUnavailableException: Exception, @unchecked Sendable {
  override var reason: String {
    "The phone's on-device AI is not available."
  }
}

internal final class EmptyOnDeviceAIResponseException: Exception, @unchecked Sendable {
  override var reason: String {
    "The phone's on-device AI returned an empty response."
  }
}
