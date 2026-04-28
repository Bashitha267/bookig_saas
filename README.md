# Booking SaaS Server

This backend uses Express + MySQL (MariaDB) and supports full CRUD for properties, rooms, bookings, and payments, plus auth (owner/admin/staff).

## Setup

1. Create a database in phpMyAdmin.
2. Run the SQL in database.sql (select your DB first).
3. Create a .env file in server/:

```
PORT=5000
JWT_SECRET=your_secret_here
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database
DB_PORT=3306
```

4. Install and run:

```
npm install
npm run dev
```

## Roles and Access

- owner: full access to all modules
- staff: dashboard + bookings only (backend enforces bookings routes only)
- admin: full access (can see all owners unless filtered by ownerId in body/query)

## API Routes

All routes require `Authorization: Bearer <token>` except auth.

### Auth

- POST /auth/register (owner signup)
- POST /auth/login
- POST /auth/logout
- POST /admin/create (admin only)
- POST /staff/register (owner only)

### Properties (owner/admin)

- GET /properties
- GET /properties/:id
- POST /properties
- PUT /properties/:id
- DELETE /properties/:id

Payload (POST/PUT):

```
{
  "name": "Hotel Alpha",
  "address": "Main Street 12",
  "city": "Colombo",
  "country": "Sri Lanka",
  "phone": "+94 11 555 0000",
  "email": "frontdesk@hotel.com"
}
```

Admin can pass `ownerId` in body when creating a property.

### Rooms (owner/admin)

- GET /rooms
- GET /rooms/:id
- POST /rooms
- PUT /rooms/:id
- DELETE /rooms/:id

Payload (POST/PUT):

```
{
  "propertyId": 1,
  "roomNumber": "101",
  "roomType": "Deluxe",
  "floor": 1,
  "capacityAdults": 2,
  "capacityChildren": 1,
  "price": 150,
  "status": "available"
}
```

### Bookings (owner/admin/staff)

- GET /bookings
- GET /bookings/:id
- POST /bookings
- PUT /bookings/:id
- DELETE /bookings/:id (owner/admin only)

Payload (POST/PUT):

```
{
  "roomId": 12,
  "guestName": "John Doe",
  "guestContact": "+1 234 567",
  "guestNic": "A1234567",
  "checkInDate": "2026-04-22",
  "checkOutDate": "2026-04-24",
  "adults": 2,
  "children": 0,
  "status": "confirmed",
  "notes": "Late arrival"
}
```

### Payments (owner/admin)

- GET /payments
- GET /payments/:id
- POST /payments
- PUT /payments/:id
- DELETE /payments/:id

Payload (POST/PUT):

```
{
  "bookingId": 33,
  "amount": 350.00,
  "currency": "USD",
  "method": "card",
  "status": "paid",
  "paidAt": "2026-04-22 14:30:00"
}
```

## Notes

- All CRUD routes are scoped to the owner (staff uses ownerId from their user).
- Admin can access everything; pass `ownerId` where needed to create data for a specific owner.
- database.sql can be re-run safely because it uses CREATE TABLE IF NOT EXISTS.
