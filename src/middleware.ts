import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // /admin配下のみBASIC認証を適用
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const basicAuth = request.headers.get('authorization');
    const url = request.nextUrl;

    // 環境変数から認証情報を取得
    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'password';

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      const [username, password] = atob(authValue).split(':');

      if (username === validUsername && password === validPassword) {
        return NextResponse.next();
      }
    }

    // 認証が必要な場合は401を返す
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
