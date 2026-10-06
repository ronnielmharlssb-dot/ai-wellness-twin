import { PresentationDemo } from "@/components/demo/presentation-demo";

export const metadata = { title: "Interactive Demo | AI Wellness Twin", description: "Explore private work-pattern insights with fictional sample data. No account required." };
const sampleReferenceDate = Date.parse("2026-10-07T00:00:00Z");

export default function DemoPage() {
  return <PresentationDemo now={sampleReferenceDate} />;
}
