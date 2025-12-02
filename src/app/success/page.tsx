
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // This page is no longer needed with the new flow.
    // Redirect users immediately back to the main application.
    router.replace('/');
  }, [router]);

  // Render nothing, or a minimal loader, as the redirect is immediate.
  return null;
}

    