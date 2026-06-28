import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = (context, next) => {
  const forwardedProto = context.request.headers.get('x-forwarded-proto');
  const url = new URL(context.request.url);

  if (forwardedProto === 'http' || (import.meta.env.PROD && url.protocol === 'http:')) {
    url.protocol = 'https:';
    return context.redirect(url.toString(), 301);
  }

  return next();
};
