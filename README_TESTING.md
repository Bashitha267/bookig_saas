Postman test instructions

1. Register Owner
- POST http://localhost:5000/auth/register
- Body (JSON): see `test_payloads/auth_register_owner.json`

2. Login (Owner)
- POST http://localhost:5000/auth/login
- Body (JSON): see `test_payloads/auth_login.json`
- Response contains `token` — copy it for next steps.

3. Register Staff (as Owner)
- POST http://localhost:5000/staff/register
- Headers: `Authorization: Bearer <OWNER_TOKEN>`
- Body (JSON): see `test_payloads/staff_register.json`

4. Create Admin (requires Admin token)
- POST http://localhost:5000/admin/create
- Headers: `Authorization: Bearer <ADMIN_TOKEN>`
- Body (JSON): see `test_payloads/admin_create.json`

Notes:
- Use `127.0.0.1:5000` or the host/port your server is running on.
- `.env` must contain your `DATABASE_URL` and `JWT_SECRET`.
