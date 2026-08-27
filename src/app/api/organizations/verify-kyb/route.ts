import { NextRequest, NextResponse } from "next/server";
import { verifyBusinessKYB } from "@/lib/organizations/kybVerifier";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taxId, companyName, countryHint } = body;

    if (!taxId || typeof taxId !== "string" || !taxId.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Business Tax ID or Corporate Registration Number is required.",
        },
        { status: 400 }
      );
    }

    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Company legal name is required for KYB verification.",
        },
        { status: 400 }
      );
    }

    // Run real-time KYB verification engine
    const kybResult = await verifyBusinessKYB(taxId, companyName, countryHint);

    return NextResponse.json({
      success: true,
      data: kybResult,
    });
  } catch (err: unknown) {
    console.error("[KYB VERIFICATION ERROR]:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to complete KYB business verification check.",
      },
      { status: 500 }
    );
  }
}
