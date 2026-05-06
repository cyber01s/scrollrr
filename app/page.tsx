import { FeedContainer } from '@/components/feed/FeedContainer'

// ISR configuration
export const revalidate = 3600

export default function Home() {
  return (
    <main className="w-full h-[100dvh] bg-black m-0 p-0 overflow-hidden">
      <FeedContainer />
    </main>
  )
}
