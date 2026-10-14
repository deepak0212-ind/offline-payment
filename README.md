# OfflinePay

A small demo of payments that can be prepared and verified without internet, then sent to the bank for settlement when the connection returns. This uses synthetic balances only. It does not move real money.

## Demo accounts

All accounts use the password `DemoPass123!`.

| Role | Username | Purpose |
|---|---|---|
| Customer 1 | `customer1` | Prepare and send an offline payment |
| Customer 2 | `customer2` | Second customer for testing |
| Merchant | `merchant` | Receive and verify payments |
| Analyst | `analyst` | Review flagged payments and disputes |

## Start locally

Requirements: Python 3.11+, Node.js, npm, and MySQL 8.

1. Create a MySQL account and grant it access to the `offline_payments` database (the account must be allowed to create the database on first startup).
2. From the `backend` directory, copy `../.env.example` to `.env` and replace the `DATABASE_URL` user and password with your actual MySQL credentials. URL-encode special characters in the password.
3. Install backend packages from the project root with `pip install -r backend/requirements.txt`, or from `backend` with `pip install -r requirements.txt`.
4. From the `backend` directory, start the API: `python -m uvicorn app.main:app --reload --port 8000`.
5. In another terminal: `cd frontend`, then run `npm install` and `npm run dev`.
6. Open the local URL printed by Vite. The API documentation is available at `http://127.0.0.1:8000/docs`.

The bank signing keypair is created automatically in `backend/keys/` on first start. Keep the private key out of Git and never share it. For deployment, set secrets in the hosting provider rather than committing `.env`.

## Run tests

From the project root, install backend requirements and start a test database. Then run:

```bash
python -m pytest backend/tests/test_all_scenarios.py -v
```

## Required five-step demo

1. Sign in as `customer1`, set up the browser device key, and add money to the offline reserve.
2. Turn on **Try offline mode** and create a payment.
3. Sign in as `merchant` in a separate browser profile/window, open **Receive payment**, and verify the payment while offline.
4. Reconnect and open **Pending sync** to upload the transaction.
5. Use the analyst account to review flagged payments and disputes. Also demonstrate replay rejection, an expired certificate, and ten identical uploads resulting in one settlement.

## Deployment checklist

- [ ] Deploy frontend to Vercel, Netlify, or Cloudflare Pages.
- [ ] Deploy FastAPI and a persistent database to a supported host.
- [ ] Set `VITE_API_URL`, `DATABASE_URL`, and a unique `SECRET_KEY` in host settings.
- [ ] Confirm the public URL and demo logins work without the developer present.
- [ ] Run the five demonstrations on the deployed site.
- [ ] Include the public URL, demo credentials, repository link, and reset-demo-data command in the final submission.

## Design notes

- `ARCHITECTURE.md`: component and data-flow overview.
- `THREAT_MODEL.md`: key threats and limitations.
- `DEMO_SCRIPT.md`: step-by-step demonstration notes.

Offline acceptance is provisional because two disconnected payees cannot know whether the same reserve has already been spent elsewhere. Settlement detects conflicting claims and caps payouts at the reserved amount. This is a learning prototype, not a production payment service.
