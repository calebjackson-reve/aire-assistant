import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#1e2416] px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-[#9aab7e] text-[10px] tracking-[0.2em] uppercase mb-2" style={{ fontFamily: "var(--font-ibm-mono)" }}>
          AIRE Intelligence
        </p>
        <h1
          className="text-[#e8e4d8] text-3xl"
          style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
        >
          Sign in to <span className="text-[#9aab7e]">AIRE</span>
        </h1>
      </div>
      <div className="w-full max-w-[400px]">
        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto w-full",
              card: "bg-[#f5f2ea] shadow-2xl border border-[#c5c9b8] rounded-2xl w-full",
              headerTitle: "text-[#1e2416] font-semibold",
              headerSubtitle: "text-[#6b7d52]",
              socialButtonsBlockButton:
                "border border-[#c5c9b8] hover:bg-[#9aab7e]/10 text-[#1e2416] rounded-xl",
              socialButtonsBlockButtonText: "text-[#1e2416] font-medium",
              formButtonPrimary:
                "bg-[#6b7d52] hover:bg-[#5a6b43] rounded-xl text-[#f5f2ea] normal-case",
              footerActionLink: "text-[#6b7d52] hover:text-[#5a6b43]",
              formFieldLabel: "text-[#2c3520] font-medium",
              formFieldInput:
                "rounded-lg border-[#c5c9b8] focus:border-[#6b7d52] text-[#1e2416] bg-white",
              identityPreviewText: "text-[#1e2416]",
              identityPreviewEditButton: "text-[#6b7d52]",
              dividerLine: "bg-[#c5c9b8]",
              dividerText: "text-[#6b7d52]",
              formFieldInputShowPasswordButton: "text-[#6b7d52]",
            },
            variables: {
              colorPrimary: "#6b7d52",
              colorText: "#1e2416",
              colorBackground: "#f5f2ea",
              colorInputBackground: "#ffffff",
              colorInputText: "#1e2416",
            },
          }}
        />
      </div>
    </div>
  );
}
