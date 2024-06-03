// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    const headers = event.request.headers;

    // Attempt to get the IP address from various headers
    const xForwardedFor = headers.get('X-Forwarded-For');
    const remoteAddr = headers.get('remoteAddr');
    const ipAddress = xForwardedFor || remoteAddr || event.getClientAddress();

    // Store the IP address in event.locals
    event.locals.ipAddress = ipAddress;

    // Proceed to the next handler
    return resolve(event);
};
