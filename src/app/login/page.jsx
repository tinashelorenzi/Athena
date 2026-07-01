'use client';
import { useRouter } from 'next/navigation';
import { LoginScreen } from '@/components/screens/LoginScreen';

export default function LoginPage() {
  const router = useRouter();
  const onLogin = () => {
    localStorage.setItem('athena.auth', '1');
    router.push('/alerts');
  };
  return <LoginScreen onLogin={onLogin} />;
}
