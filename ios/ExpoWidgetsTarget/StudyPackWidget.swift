import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct StudyPackWidget: Widget {
  let name: String = "StudyPackWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Study Pack Progress")
    .description("See your current Study Pack and available tools.")
    .supportedFamilies([.systemLarge])
    .contentMarginsDisabled()
  }
}