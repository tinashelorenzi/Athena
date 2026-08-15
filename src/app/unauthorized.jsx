import { StatusScreen } from '@/components/screens/StatusScreen';

/* 401 — rendered when `unauthorized()` is called (not signed in). */
export default function Unauthorized() {
  return <StatusScreen variant={401} />;
}
