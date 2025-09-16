// app/int/error/page.tsx
import ErrorClient from './ErrorClient';

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; message?: string; client_id?: string; state?: string }>;
}) {
  const sp = await searchParams;
  const code = sp.code || 'unknown_error';
  const message = sp.message || 'Something went wrong.';
  const client = sp.client_id || '—';

  return <ErrorClient code={code} message={message} client={client} />;
}
