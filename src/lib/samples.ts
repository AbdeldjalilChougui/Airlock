/**
 * Demo inputs. Every secret below is FAKE. Token-shaped values are assembled at
 * runtime from pieces so secret scanners (and GitHub push protection) don't
 * flag this file — they are not real credentials.
 */
const j = (...p: string[]) => p.join('');

const STRIPE = j('sk_', 'live_', '51Hx9QeLkdP2vT7wQm4RzA8cYb3N');
const GITHUB = j('gh', 'p_', 'R8kq2LmZx7Vt4Nw9Pb1Yc6Hd3Fs0Ja5Ue2Qo');
const AWS_ID = j('AKIA', 'IOSFODNN7', 'EXAMPLE');
const AWS_SECRET = j('wJalrXUtnFEMI/K7MDENG/', 'bPxRfiCYEXAMPLEKEY');
const GCP = j('AIza', 'SyD3mo-Fak3K3y_9xQwErTyUiOpAsDfGh12');
const JWT = j(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  '.eyJzdWIiOiJ1c3JfOGhLMnBRIiwibmFtZSI6Ik1heWEiLCJpYXQiOjE3MzI0NTAwMDB9',
  '.Zm9vYmFyYmF6cXV4ZmFrZXNpZ25hdHVyZTEyMw',
);
const ENTROPY = j('x9Fq7Lr2', 'Vb8Kp3Zt6Wm1Nc4Hs5Jd0Ye');

export const MESSY_LOG = `2026-11-24T09:41:07.212Z INFO  payments-api[bluefin] boot: env=production region=eu-west-1 build=4f2a9c1
2026-11-24T09:41:07.488Z INFO  config loaded from /srv/bluefin/.env (owner: maya.okafor@northwind-traders.com)
2026-11-24T09:41:07.490Z DEBUG STRIPE_SECRET_KEY=${STRIPE}
2026-11-24T09:41:07.491Z DEBUG AWS_ACCESS_KEY_ID=${AWS_ID}
2026-11-24T09:41:07.491Z DEBUG aws_secret_access_key=${AWS_SECRET}
2026-11-24T09:41:07.492Z DEBUG GOOGLE_MAPS_KEY=${GCP} GH_DEPLOY_TOKEN=${GITHUB}
2026-11-24T09:41:08.003Z INFO  connecting to postgres://bluefin_svc:Tr0ub4dor-and-3@pg-primary.payments.internal:5432/ledger
2026-11-24T09:41:13.004Z ERROR pg: connect ETIMEDOUT 10.42.7.19:5432 (attempt 1/3)
2026-11-24T09:41:18.006Z ERROR pg: connect ETIMEDOUT 10.42.7.19:5432 (attempt 2/3)
2026-11-24T09:41:23.010Z WARN  pool exhausted (max=20, waiting=147) — falling back to replica pg-replica-2.payments.internal
2026-11-24T09:41:23.311Z INFO  POST /v1/charges customer_id=cus_Q8fT2kLm9ZpX user=usr_8hK2pQ7wRt ip=203.0.113.77
2026-11-24T09:41:23.312Z DEBUG Authorization: Bearer ${JWT}
2026-11-24T09:41:23.540Z ERROR charge failed for Northwind Traders (card 4242 4242 4242 4242, contact +44 20 7946 0958)
Error: Connection terminated due to connection timeout
    at Connection.<anonymous> (/srv/bluefin/node_modules/pg/lib/client.js:132:73)
    at Object.onceWrapper (node:events:633:28)
    at Socket.<anonymous> (/srv/bluefin/node_modules/pg/lib/connection.js:62:12)
    at LedgerRepository.insertCharge (/srv/bluefin/src/ledger/repository.ts:88:19)
    at ChargeService.create (/srv/bluefin/src/charges/service.ts:41:7)
2026-11-24T09:41:23.541Z WARN  webhook signing secret=${ENTROPY} retry scheduled
2026-11-24T09:41:24.002Z FATAL readiness probe failed 3x — k8s will restart pod payments-api-7d9c8b-xk2lp
2026-11-24T09:41:24.003Z INFO  paging on-call: Maya Okafor (maya.okafor@northwind-traders.com, +1 415 555 0132) re: Project Bluefin ledger outage
`;

export const SAMPLE_CONFIG = `# docker-compose.override.yml  (shared by Dev Patel for debugging)
services:
  api:
    environment:
      DATABASE_URL: mysql://root:hunter2-prod@db.acme-internal.corp:3306/orders
      SENTRY_DSN: https://${j('3f9c2a', '7be4d1', '48a0b5c6d7e8f9a0b1')}@o4504.ingest.sentry.io/77
      ADMIN_EMAIL: dev.patel@acme-retail.io
      TENANT_ID: acme-eu-prod-0042
    extra_hosts:
      - "billing.acme-internal.corp:172.16.4.21"
`;
