import AuthenticationServices
import ExpoModulesCore
import UIKit

public final class StudyBoltAuthSessionModule: Module {
  private var session: ASWebAuthenticationSession?
  private var presentationProvider: AuthSessionPresentationProvider?

  public func definition() -> ModuleDefinition {
    Name("StudyBoltAuthSession")

    AsyncFunction("open") { (address: String, promise: Promise) in
      guard self.session == nil, let url = URL(string: address), url.scheme == "https",
            let window = UIApplication.shared.connectedScenes
              .compactMap({ $0 as? UIWindowScene })
              .filter({ $0.activationState == .foregroundActive })
              .flatMap({ $0.windows }).first(where: { $0.isKeyWindow }) else {
        promise.resolve(["type": "error"])
        return
      }

      let presentationProvider = AuthSessionPresentationProvider(window: window)
      self.presentationProvider = presentationProvider
      let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "studybolt") { [weak self] url, error in
        DispatchQueue.main.async {
          self?.session = nil
          self?.presentationProvider = nil
          if let url {
            promise.resolve(["type": "success", "url": url.absoluteString])
          } else if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
            promise.resolve(["type": "cancel"])
          } else {
            promise.resolve(["type": "error"])
          }
        }
      }
      session.presentationContextProvider = presentationProvider
      self.session = session
      if !session.start() {
        self.session = nil
        self.presentationProvider = nil
        promise.resolve(["type": "error"])
      }
    }.runOnQueue(.main)
  }
}

private final class AuthSessionPresentationProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
  private weak var window: UIWindow?

  init(window: UIWindow) {
    self.window = window
    super.init()
  }

  public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    window ?? ASPresentationAnchor()
  }
}
