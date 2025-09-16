// app/int/[uid]/page.tsx
import IntClient from './IntClient';

export default async function Page({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  return <IntClient uid={uid} />;
}