import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct StudyFocusWidget: Widget {
  let name: String = "StudyFocusWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Study Focus")
    .description("See what to study next and how long it may take.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}