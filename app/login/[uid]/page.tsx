// app/login/[uid]/page.tsx
export default async function LoginPage({ params }: { params: Promise<{ uid: string }> }) {
    const { uid } = await params;
    const action = `http://localhost:4000/interaction/${uid}/login`; // прямо на провайдера
  
    return (
      <main style={{ maxWidth: 420, margin: '48px auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 28, marginBottom: 16 }}>Sign in</h1>
  
        <form method="post" action={action} style={{ display: 'grid', gap: 12 }}>
          <input type="email" name="login" placeholder="email" required style={{ padding: 8, border: '1px solid #ddd', borderRadius: 8 }} />
          <input type="password" name="password" placeholder="password" style={{ padding: 8, border: '1px solid #ddd', borderRadius: 8 }} />
          <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, background: '#2563eb', color: '#fff' }}>
            Sign in
          </button>
        </form>
  
        <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
          UID: <code>{uid}</code> · POST → <code>{action}</code>
        </p>
      </main>
    );
  }