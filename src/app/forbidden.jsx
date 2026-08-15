import { StatusScreen } from '@/components/screens/StatusScreen';

/* 403 — rendered when `forbidden()` is called (signed in, but no access). */
export default function Forbidden() {
  return <StatusScreen variant={403} />;
}
