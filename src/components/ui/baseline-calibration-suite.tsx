"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssessmentEvidence } from "@/components/ui/assessment-evidence";
import { getMetricsForEmployee } from "@/lib/wellbeing/employeeMetrics";
import { buildEmployeeAssessment } from "@/lib/wellbeing/employeeAssessment";
import { CALIBRATED_DEMO_ID, seedCalibratedDemoAccount, resetCalibratedDemoAccount } from "@/lib/wellbeing/calibratedAccountSeeder";

interface BaselineSuiteProps {
  employeeId: string;
  daysCollected: number;
  requiredDays?: number;
  onMetricsUpdated: () => void;
}
export function BaselineCalibrationSuite({ employeeId, onMetricsUpdated }: BaselineSuiteProps) {
  const assessment = buildEmployeeAssessment(employeeId ? getMetricsForEmployee(employeeId) : []);
  return <Card className="space-y-4 p-6">
    <h2 className="text-lg font-bold">Building your personal comparison</h2>
    <p className="text-sm text-slate-500">Each metric needs its own 28 earlier observed dates. Connecting an account alone
      does not establish observations. The seven recent dates are separate from the baseline.</p>
    <AssessmentEvidence assessment={assessment} />
    {employeeId === CALIBRATED_DEMO_ID && <div className="space-y-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <p>Demo only: create 28 baseline dates and seven recent dates of synthetic observations. No survey responses are created.</p>
      <div className="flex flex-wrap gap-2"><Button onClick={() => { seedCalibratedDemoAccount(); onMetricsUpdated(); }}>Load synthetic demo</Button>
        <Button variant="outline" onClick={() => { resetCalibratedDemoAccount(); onMetricsUpdated(); }}>Reset demo observations</Button></div>
    </div>}
  </Card>;
}
