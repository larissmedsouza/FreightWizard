'use client';

export default function BillingCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#0a0a1a] to-[#050510] text-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🙂</div>
        <h1 className="text-2xl font-bold mb-2">No worries — you can upgrade anytime</h1>
        <a href="/pricing" className="inline-block mt-4 px-6 py-3 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full font-medium">
          Back to Pricing
        </a>
      </div>
    </div>
  );
}
