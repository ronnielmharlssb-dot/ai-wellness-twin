"use client";

import { useEffect, useState } from "react";
import { getLocalSessionUser } from "@/lib/supabase/auth";
import { getMetricsForEmployee } from "@/lib/wellbeing/employeeMetrics";
import { buildEmployeeAssessment, type EmployeeAssessment } from "@/lib/wellbeing/employeeAssessment";

export function useEmployeeAssessment() {
  const [assessment, setAssessment] = useState<EmployeeAssessment | null>(null);
  useEffect(() => {
    const load = () => {
      const user = getLocalSessionUser();
      setAssessment(buildEmployeeAssessment(user?.role === "employee" ? getMetricsForEmployee(user.id) : []));
    };
    load();
    const timer = setInterval(load, 60000); // Move the comparison window when a UTC date closes.
    window.addEventListener("wellness-telemetry-update", load);
    window.addEventListener("wellness-auth-update", load);
    window.addEventListener("storage", load);
    return () => { clearInterval(timer); window.removeEventListener("wellness-telemetry-update", load); window.removeEventListener("wellness-auth-update", load); window.removeEventListener("storage", load); };
  }, []);
  return assessment;
}
