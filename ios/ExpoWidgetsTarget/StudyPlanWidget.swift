import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct StudyPlanWidget: Widget {
  let name: String = "StudyPlanWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Today’s Study Plan")
    .description("Keep today’s next study block in view.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}