import { StatusScreen } from '@/components/screens/StatusScreen';

/* 404 — rendered for unmatched routes and any `notFound()` call. */
export default function NotFound() {
  return <StatusScreen variant={404} />;
}
