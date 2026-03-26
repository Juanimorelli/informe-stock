import React from 'react';
import StockDashboard from '@/components/StockDashboard';

async function getStockData() {
  try {
    // Use NEXT_PUBLIC_BASE_URL in production, fallback to relative for server components
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/stock`, { cache: 'no-store' });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.data;
  } catch (e) {
    return null;
  }
}

export default async function Page() {
  // Due to Next.js server components sometimes failing to fetch their own API routes during build,
  // we'll fetch safely. If it fails, our dashboard will handle it gracefully.
  const initialData = await getStockData();

  return (
    <main className="h-screen overflow-hidden bg-slate-100 flex flex-col p-2 md:p-4">
      <StockDashboard initialData={initialData} />
    </main>
  );
}
