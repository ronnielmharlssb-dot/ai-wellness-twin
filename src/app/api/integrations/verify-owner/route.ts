import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface VerificationRecord {
  code: string;
  expiresAt: number;
}

// In-memory store for active verification codes with 10-minute expiry
const activeCodes = new Map<string, VerificationRecord>();

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, code } = body;

    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email address is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Action 1: Send verification code to real email
    if (action === "send") {
      const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
      
      activeCodes.set(normalizedEmail, {
        code: generatedPin,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      // 1. Try sending real live email via Supabase OTP service
      let realEmailSent = false;
      if (supabase) {
        try {
          const { error } = await supabase.auth.signInWithOtp({
            email: normalizedEmail,
            options: {
              shouldCreateUser: true,
            },
          });
          if (!error) {
            realEmailSent = true;
          } else {
            console.warn("Supabase OTP mail notice:", error.message);
          }
        } catch (mailErr) {
          console.warn("Live mail delivery notice:", mailErr);
        }
      }

      // Log dispatch status to server terminal
      console.log(`\n======================================================`);
      console.log(`📧 [SECURITY CONFIRMATION CODE DISPATCHED]`);
      console.log(`To: ${normalizedEmail}`);
      console.log(`Subject: Your AI Wellness Twin Integration Security PIN`);
      console.log(`Security Code: ${generatedPin}`);
      console.log(`Live Mail Delivery Status: ${realEmailSent ? "SENT TO INBOX VIA SUPABASE" : "LOGGED TO CONSOLE"}`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log(`======================================================\n`);

      return NextResponse.json({
        success: true,
        realEmailSent,
        message: `A 6-digit confirmation code has been dispatched to ${normalizedEmail}.`,
      });
    }

    // Action 2: Verify code submitted by user
    if (action === "verify") {
      const submittedCode = (code || "").trim();
      const record = activeCodes.get(normalizedEmail);

      // Check 1: Check against locally stored verification record
      if (record && record.code === submittedCode) {
        if (Date.now() <= record.expiresAt) {
          activeCodes.delete(normalizedEmail);
          return NextResponse.json({
            success: true,
            verified: true,
            message: "Email ownership successfully confirmed.",
          });
        }
      }

      // Check 2: Try verifying via Supabase OTP if user entered the Supabase email code
      if (supabase) {
        try {
          const { error } = await supabase.auth.verifyOtp({
            email: normalizedEmail,
            token: submittedCode,
            type: "email",
          });
          if (!error) {
            activeCodes.delete(normalizedEmail);
            return NextResponse.json({
              success: true,
              verified: true,
              message: "Email ownership successfully confirmed via Supabase OTP.",
            });
          }
        } catch {
          // Ignore and continue to error response
        }
      }

      return NextResponse.json(
        { success: false, error: "Invalid or expired confirmation code. Please check your email inbox and enter the 6-digit PIN." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Invalid action specified." },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error("Verification code API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process verification request." },
      { status: 500 }
    );
  }
}
