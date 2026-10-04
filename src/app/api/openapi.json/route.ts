import { NextResponse } from 'next/server';
import pkg from '../../../../package.json';

const envelopeError = {
  description: 'Error',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
};
const security = [{ sessionCookie: [] }, { bearerAuth: [] }];
const paging = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];

export async function GET() {
  return NextResponse.json({
    openapi: '3.0.0',
    info: { title: 'Finova API', version: pkg.version },
    paths: {
      '/api/health': {
        get: { summary: 'Health check (unauthenticated)', responses: { '200': { description: '{ ok, version, db }' } } },
      },
      '/api/accounts': {
        get: {
          summary: 'List chart-of-accounts for the active organization',
          security,
          parameters: [
            ...paging,
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] } },
            { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: { '200': { description: 'Paginated accounts' }, '401': envelopeError, '403': envelopeError },
        },
        post: {
          summary: 'Create an account',
          security,
          responses: { '201': { description: 'Created' }, '400': envelopeError, '401': envelopeError, '409': envelopeError, '429': envelopeError },
        },
      },
      '/api/alerts': {
        get: {
          summary: 'Evaluate smart financial alerts for the active organization',
          security,
          parameters: [
            { name: 'overdueGraceDays', in: 'query', schema: { type: 'integer', minimum: 0, maximum: 30 } },
            { name: 'expenseIncreasePct', in: 'query', schema: { type: 'number', minimum: 0, maximum: 500 } },
            { name: 'expenseIncreaseMin', in: 'query', schema: { type: 'number', minimum: 0 } },
            { name: 'expectedReceiptsDays', in: 'query', schema: { type: 'integer', enum: [7, 14, 30] } },
          ],
          responses: { '200': { description: 'Derived alerts and generated timestamp' }, '400': envelopeError, '401': envelopeError, '403': envelopeError, '429': envelopeError },
        },
      },
      '/api/journal': {
        get: { summary: 'List journal entries (persistence pending)', security, parameters: paging, responses: { '200': { description: 'Paginated entries' }, '401': envelopeError } },
        post: { summary: 'Post a journal entry (persistence pending)', security, responses: { '400': envelopeError, '401': envelopeError, '501': envelopeError } },
      },
    },
    components: {
      securitySchemes: {
        sessionCookie: { type: 'apiKey', in: 'cookie', name: 'next-auth.session-token' },
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
      schemas: {
        ErrorEnvelope: {
          type: 'object',
          required: ['success', 'error'],
          properties: { success: { type: 'boolean', enum: [false] }, error: { type: 'string' } },
        },
      },
    },
  });
}
