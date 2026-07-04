# Home Tiffin — Backend API Specification

Derived from the implemented frontends (customer / cook / rider apps + admin panel).
Envelope, auth mechanics, and code style follow `utili_source/backend`; consumed by
Flutter clients in the `mvuala` integration style (Bearer token, `{ message, data }`).

Database: MySQL `home_tiffin` (localhost, root). Currency integer paisa-free rupees ("Rs.").
All money computed server-side from `settings` (delivery fee, commission %).

## Roles & status model

- `users.role`: `customer | cook | rider | admin`
- `users.status`: `pending | active | blocked` (customers are `active` immediately;
  cooks/riders register as `pending` until admin approval)
- Order lifecycle (single source of truth):
  `new → accepted → preparing → ready → on_the_way → delivered`, terminal `cancelled`
  - cook: accept (new→accepted→preparing is implicit accept+prep), mark ready
  - rider: accept assignment (ready→on_the_way requires assigned rider + pickup), deliver
  - admin: assign rider (sets rider on ready order), force-cancel with reason
  - COD: on `delivered`, order total adds to rider `cash_in_hand`

## Tables

| Table | Key fields |
|---|---|
| users | id, name, email?, phone (unique), password, role, status, profile_image?, timestamps |
| cook_profiles | user_id FK, kitchen_name, city, area, bio?, rating (cached avg), total_reviews, is_kitchen_open, cnic_front?, cnic_back?, kitchen_photos (json), rejection_reason?, approved_at? |
| rider_profiles | user_id FK, city, vehicle_type, vehicle_brand?, vehicle_model?, license_plate, cnic_number, cnic_front?, cnic_back?, license_photo?, vehicle_photo?, is_online, cash_in_hand, rejection_reason?, approved_at? |
| addresses | user_id FK, type (home/work/other), label, full_name, phone, address, area, city, latitude?, longitude?, delivery_instructions?, is_default |
| dishes | cook_id FK(users), name, description?, category, price, is_veg, spice_level (1-3), prep_time_minutes, daily_quantity?, is_available (cook), is_hidden (admin), image? |
| orders | order_number (#1229+), customer_id, cook_id, rider_id?, address snapshot (json), status, item_total, delivery_fee, discount, tax, total, payment_method ('cod'), special_instructions?, cancel_reason?, cancelled_by?, placed_at, accepted_at?, ready_at?, picked_up_at?, delivered_at? |
| order_items | order_id FK, dish_id, name+price snapshots, quantity, is_veg |
| reviews | order_id (unique), customer_id, cook_id, stars (1-5), comment? |
| notifications | user_id, title, body, type, is_read |
| rider_settlements | rider_id, amount, settled_by (admin id), settled_at |
| cook_payouts | cook_id, amount, order_count, commission_pct snapshot, paid_by, paid_at |
| settings | single row: delivery_fee (50), commission_pct (15), service_areas (json), support_phone |

## Endpoints

Prefix `/api/v1`. Success: `200/201 { "message": string, "data": ... }`.
Errors: `4xx { "message": string }`; validation `422 { "message", "errors": {field: [msg]} }`.
Auth: `Authorization: Bearer <token>`. Role-guarded groups.

### Auth (shared)
- `POST /auth/register` — name, phone, email?, password, role (customer|cook|rider) + role profile fields (cook: kitchen_name, city, area; rider: city, vehicle_type, license_plate, cnic_number). Cook/rider created `pending` → response indicates awaiting approval.
- `POST /auth/login` — phone (or email) + password → `{ access_token, user (+profile) }`; blocked → 403; pending cook/rider can log in but sees pending state.
- `GET /auth/me` · `POST /auth/logout`
- `POST /auth/documents` — multipart doc upload for pending cook/rider (cnic_front/back, kitchen_photos[] / license_photo, vehicle_photo)

### Customer
- `GET /cooks?search=&area=` — active cooks w/ profile, rating, open flag, dish count
- `GET /cooks/{id}` — profile + visible dishes (available && !hidden)
- `GET /dishes/popular` — top dishes across active cooks
- `GET|POST /addresses` · `PUT|DELETE /addresses/{id}` · `POST /addresses/{id}/default`
- `POST /orders` — { cook_id, items: [{dish_id, quantity}], address_id, special_instructions? } → totals computed server-side (delivery fee + tax 5% + discount Rs.100 over Rs.1000, mirroring app math) → status `new`
- `GET /orders` (mine, newest first) · `GET /orders/{id}` (with items + timeline timestamps)
- `POST /orders/{id}/rate` — { stars, comment? } only when delivered & unrated; updates cook rating cache
- `GET /notifications` · `POST /notifications/read-all`

### Cook (role cook, active)
- `GET /cook/dashboard` — today: orders count, earnings (delivered totals × (1-commission)), pending count, rating, available/total dishes
- `POST /cook/kitchen/toggle`
- `GET /cook/dishes` · `POST /cook/dishes` (multipart w/ image) · `PUT /cook/dishes/{id}` · `DELETE /cook/dishes/{id}` · `POST /cook/dishes/{id}/toggle-availability`
- `GET /cook/orders?status=new|active|history`
- `POST /cook/orders/{id}/accept` → accepted+preparing · `/reject` {reason} → cancelled · `/ready` → ready
- `GET /cook/earnings` — period summaries + payout history

### Rider (role rider, active)
- `POST /rider/status/toggle` — online/offline
- `GET /rider/orders/available` — status ready, no rider (admin may also assign directly)
- `GET /rider/orders?status=ongoing|completed`
- `POST /rider/orders/{id}/accept` — self-assign → on_the_way after `/pickup`; `/pickup` sets picked_up_at; `/deliver` → delivered, cash_in_hand += total
- `GET /rider/earnings` — daily/weekly/monthly deliveries + fees, cash_in_hand, settlement history
- `GET|PUT /rider/profile` · `POST /rider/documents` (multipart)

### Admin (role admin)
- `GET /admin/dashboard` — today's orders, GMV, pending cooks/riders, online riders, counts by status, recent orders
- `GET /admin/cooks?status=pending|active|blocked&search=` · `GET /admin/cooks/{id}` (docs + dishes)
- `POST /admin/cooks/{id}/approve | reject {reason} | block | unblock`
- `POST /admin/dishes/{id}/hide | unhide`
- `GET /admin/riders?...` · `GET /admin/riders/{id}` · approve/reject/block/unblock (same shape)
- `GET /admin/customers?search=` · `POST /admin/customers/{id}/block | unblock`
- `GET /admin/orders?status=&search=` · `GET /admin/orders/{id}`
- `POST /admin/orders/{id}/assign-rider` {rider_id} · `POST /admin/orders/{id}/cancel` {reason}
- `GET /admin/settlements/riders` — per-rider cash_in_hand + history · `POST /admin/settlements/riders/{rider_id}/deposit`
- `GET /admin/settlements/cooks` — owed = delivered totals × (1-commission) − paid · `POST /admin/settlements/cooks/{cook_id}/pay`
- `GET|PUT /admin/settings`

## Seed data (continuity with current frontend mocks)

Admin `admin@hometiffin.pk` / `zubair62880`. 8 cooks (Fatima's Kitchen, Auntie Zara's
Delights, Lahori Zaiqa, Khan's Desi Handi, … — 3 pending, 1 blocked), each active cook
4-6 dishes (Chicken Biryani Rs. 350, Chicken Karahi Rs. 450, Vegetable Pulao Rs. 200 …).
6 riders (Ahmed Khan cash Rs. 6,250, Bilal Hussain, Usman Tariq, 2 pending, 1 blocked).
8 customers (Muhammad Ahmad +92 300 1234567 …, each with 1-3 addresses in Islamabad /
Rawalpindi). Orders #1229+ spanning every status. Settings row per defaults above.
All passwords `password123` except admin.

## .env third-party placeholders

`GOOGLE_MAPS_API_KEY=`, `FCM_SERVER_KEY=`, `SMS_PROVIDER_API_KEY=` (OTP later),
`JWT_SECRET` (generated). DB: host localhost, user root, password as provided,
database `home_tiffin`.
