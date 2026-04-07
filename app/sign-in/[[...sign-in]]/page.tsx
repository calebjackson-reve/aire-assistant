import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-forest-deep">
      <div className="mb-8 text-center">
        <p className="text-sage text-[10px] tracking-[0.2em] uppercase mb-2">AIRE Intelligence</p>
        <h1 className="font-display italic text-cream text-3xl">
          Sign in to <span className="text-[#9aab7e]">AIRE</span>
        </h1>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-[#f4f1ec] shadow-2xl border-0 rounded-2xl",
            headerTitle: "text-[#1e2416] font-semibold",
            headerSubtitle: "text-[#6b7d52]",
            socialButtonsBlockButton: "border-[#9aab7e]/20 hover:bg-[#9aab7e]/10 text-[#1e2416] rounded-xl",
            formButtonPrimary: "bg-[#6b7d52] hover:bg-[#5c6e2e] rounded-xl",
            footerActionLink: "text-[#6b7d52] hover:text-[#5c6e2e]",
            formFieldInput: "rounded-lg border-[#9aab7e]/20 focus:border-[#6b7d52]",
          },
        }}
      />
    </div>
  );
}
