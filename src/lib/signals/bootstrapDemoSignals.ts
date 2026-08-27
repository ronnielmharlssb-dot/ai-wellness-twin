import { generateDemoSignal }
  from "./demoSignalGenerator";

import { signalToMetrics }
  from "./metricsMapper";

import { saveEmployeeMetricsBatch }
  from "@/lib/wellbeing/employeeMetrics";

export function bootstrapDemoSignals(
  employeeId: string
) {
  const metrics = [];

  for (let day = 0; day < 35; day++) {
    const signal =
      generateDemoSignal(
        employeeId,
        day
      );

    metrics.push(
      signalToMetrics(signal)
    );
  }

  saveEmployeeMetricsBatch(metrics);
}