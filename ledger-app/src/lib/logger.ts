import pino from 'pino';
export const logger=pino({level:process.env.LOG_LEVEL??'info'});
export function requestId(request:Request){return request.headers.get('x-request-id')??crypto.randomUUID();}
