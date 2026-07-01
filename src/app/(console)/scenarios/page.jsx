'use client';
import { useRouter } from 'next/navigation';
import { ScenariosScreen } from '@/components/screens/ScenariosScreen';

export default function ScenariosPage() {
  const router = useRouter();
  // Starting a scenario drops you into the live alert queue.
  return <ScenariosScreen onStart={() => router.push('/alerts')} />;
}
