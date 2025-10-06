'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LogoutFormContent() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const xsrf = searchParams.get('xsrf');
  const postLogoutRedirectUri = searchParams.get('post_logout_redirect_uri');

  useEffect(() => {
    // Автоматически сабмитим форму при загрузке
    if (formRef.current) {
      formRef.current.submit();
    }
  }, []);

  return (
    <div style={{
      margin: 0,
      padding: 0,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <form 
        ref={formRef}
        method="post" 
        action="/api/oidc/session/end/confirm"
        style={{ display: 'none' }}
      >
        {xsrf && <input type="hidden" name="xsrf" value={xsrf} />}
        {postLogoutRedirectUri && (
          <input type="hidden" name="post_logout_redirect_uri" value={postLogoutRedirectUri} />
        )}
        <input type="hidden" name="logout" value="yes" />
      </form>
      <p style={{ color: 'white', fontSize: '18px' }}>Signing out...</p>
    </div>
  );
}

export default function LogoutFormPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LogoutFormContent />
    </Suspense>
  );
}

