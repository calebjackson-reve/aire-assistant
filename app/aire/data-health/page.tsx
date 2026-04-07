import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import DataHealthDashboard from './DataHealthDashboard'

export const metadata = {
  title: 'Data Health | AIRE Intelligence',
}

export default async function DataHealthPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-1">Data Health Monitor</h1>
        <p className="text-zinc-400 text-sm mb-8">
          Real-time status of AIRE intelligence tables, data freshness, and cache performance.
        </p>
        <DataHealthDashboard />
      </div>
    </div>
  )
}
