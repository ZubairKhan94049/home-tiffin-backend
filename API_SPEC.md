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
| dishes | cook_id FK(users), name, description?, category + category_id FK(dishcategories), price, serves?, spice_level (1-3), prep_time_minutes, available_days?, is_available (cook), is_hidden (admin), image? (cover) |
| dishcategories | name, description?, sort_order, is_active — the list cooks pick from |
| dishimages | dish_id FK, image, sort_order — up to 3 per dish; sort_order 0 is the cover |
| dishvariations | dish_id FK, name, price, serves?, sort_order — sizes or options |
| dishavailability | dish_id FK, available_from, available_to, sort_order — serving windows |
| dishcontents | dish_id FK, name, quantity?, sort_order — what a platter is made up of |
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
- `POST /auth/register` — name, password, role (customer|cook|rider) + role profile fields (cook: kitchen_name, city, area; rider: city, vehicle_type, license_plate, cnic_number). Cook/rider created `pending` → response indicates awaiting approval.
  - Identify with `phone` and optional `email`, **or** a single `identifier` the server splits (anything containing `@` is an email, otherwise a phone). The customer app sends `identifier`; cook and rider send the pair. One of the two must be present — `tblusers.phone` is nullable now so an email-only account is possible.
- `POST /auth/social` — Google / Apple / Facebook sign-in for customers. Body `{ provider, token, name? }`. The token is verified with the provider itself (Google tokeninfo, Apple JWKS, Facebook debug_token), never trusted as sent, and the audience is checked so a token minted for another app cannot be replayed. Matches an existing account by provider id, then by email (linking it), otherwise creates an active customer with no phone or password. Returns 201 for a new account, 200 otherwise, with `is_new`.
- `GET /auth/providers` — which of the three have server credentials. The apps draw only those buttons, so one can never be tapped into a "not configured" error.
  - Configure with `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS` (comma-separated) and `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`.
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
- `POST /orders/{id}/cancel` — authenticated customer, own order only; empty body. Allowed in `new`, legacy `accepted`, `preparing`, or `ready` (including rider-assigned), provided `picked_up_at` is null. Atomically sets `cancelled`, `cancelled_by=customer`, `cancelled_at` and persists notifications for customer, cook and assigned rider. Keeps the assigned rider for history. Returns `200 {success:true,data:order+items,message}`; retrying a customer-cancelled order succeeds without duplicate notifications. Foreign order → 404; wrong role → 403; invalid ID → 400. Pickup/terminal conflict → `409 {success:false,message,data:currentOrder+items}`. Cancellation and pickup lock the same order row, so only one can succeed. On timeout/5xx clients must GET the order to reconcile before offering another cancellation attempt. No fee, refund or required cancellation reason has been introduced.
- `POST /orders/{id}/rate` — { stars, comment? } only when delivered & unrated; updates cook rating cache
- `GET /notifications` · `POST /notifications/read-all`

### Cook (role cook, active)
- `GET /cook/dashboard` — today: orders count, earnings (delivered totals × (1-commission)), pending count, rating, available/total dishes
- `POST /cook/kitchen/toggle`
- `GET /cook/profile` — the profile screen: user + `profile` + `documents` (the four filenames) + `status` (the four application rows and the rejection note) + `support_phone` from platform settings. Never returns the password hash.
- `PUT /cook/profile` — partial. Personal (`name`, `phone`, `email` — rejected with 409 if already on another account), kitchen (`kitchen_name`, `bio`, `city`, `area`, `address_street|house|state|postal_code|extra`) and hours (`operating_days` CSV of mon..sun where empty or all seven stores NULL, `opening_time`, `closing_time` as HH:MM, `daily_capacity`). Closing must be after opening. Responds with the whole profile.
- `GET /cook/insights?range=7d|30d|prev_month` — the dashboard. Returns `range`, `today`, `sales` (orders, gross, net, average_order_value, `change_pct` and `orders_change_pct` against the matching window before it, and a gap-filled `daily` series), `hourly` (24 buckets), `rejections` (placed, cancelled, rate_pct, lost_sales, top reasons with shares), `customers` (people, new vs returning orders), `top_items`, `kitchen` and `rating`. Sales count delivered orders only; the rejection rate counts every order placed. All date maths is in the server's local time.
- `GET /cook/dishes` · `POST /cook/dishes` · `PUT /cook/dishes/{id}` · `DELETE /cook/dishes/{id}` · `POST /cook/dishes/{id}/toggle-availability`
  - Multipart. `images` takes up to 3 files; `kept_images` is a CSV of the hosted paths to keep, so one save can add, drop and reorder photos. An item needs at least one photo. A cook may only keep paths from their own items.
  - `category_id` comes from `GET /dish-categories` (`category` free text is still accepted as a fallback).
  - `variations` is a JSON array of `{ name, price, serves }` — sizes (Small/Medium/Large) or options (Soup/Dry). Rows missing a name or a positive price are dropped. A blank `serves` comes back null and falls back to the item's own. With variations, `price` is the cheapest one, which menus show as "from".
  - `serves` is free text ("1 person", "2-3 people") and is only used when the item has no variations — each variation carries its own.
  - `availability` is a JSON array of `{ from, to }` as `HH:MM` — an item may be served over several windows (breakfast and dinner). A window that does not end after it starts is dropped; an empty list means all day. `available_days` is a CSV of `mon..sun` — empty or all seven means every day and is stored NULL.
  - Both are bounded by the kitchen's own hours from `PUT /cook/profile`: a window outside `opening_time`–`closing_time`, or a day outside `operating_days`, is rejected with 400. An edit is checked against what the item would end up with, not just what the request changes.
  - `contents` is a JSON array of `{ name, quantity }` — what a platter or deal is made up of ("Chawal, 1/2 kg"). Rows without a name are dropped; `quantity` is free text and optional.
  - `daily_quantity` is no longer collected.
  - Reads return `images: [{ image }]` and `variations: [{ name, price }]`. `is_veg` is no longer written or read — the category covers it.
- `GET /cook/dishes/{id}/analytics` — how one item has sold: `totals` (orders, quantity, revenue, average_order_value, first/last sold), `last_7_days` (with `change_pct` vs the week before, null when there is nothing to compare), `last_30_days`, `menu` (rank, selling_dishes, revenue_share_pct) and a 30-day `daily` series with empty days filled in. Delivered orders only; revenue uses the order-line price snapshot, so changing a price never rewrites history.
- `GET /dish-categories` — public; the menu categories a cook picks from
- `GET /dishes/{id}` — one orderable dish with its kitchen; hidden dishes and inactive cooks are 404.
- `GET /banners` — the customer home carousel: active banners inside their schedule, in order.
- `GET|POST /admin/banners` · `PUT /admin/banners/reorder` {ids} · `PUT|DELETE /admin/banners/{id}` — run the carousel. Multipart with optional `image`; text (eyebrow, title, subtitle, cta_label) is all optional but a banner needs a title or an image. `action_type` is none | explore | search | cook | dish | url, with `action_value` the term, id or link (links must be http/https). Optional `starts_at`/`ends_at` schedule it; `is_active` pauses it.
- `GET /dishes/search?q=` — dishes matching the name, description, category or kitchen name; name matches sort first. Two characters minimum; only orderable dishes from active cooks.
- `GET /dishes/favourites` · `GET /dishes/favourites/ids` · `PUT|DELETE /dishes/{id}/favourite` — a customer's hearted dishes. Hearting is idempotent (unique on customer + dish); hidden dishes and inactive cooks drop out of the list; deleting a dish removes its hearts.
- `GET /legal` — public; `privacy_policy`, `terms_conditions`, `partner_contract` and `updated_at`. The text lives in `tblsettings` so a correction needs no app release; `node scripts/seed-legal.js` writes starter drafts (`--force` overwrites).
- `GET /cook/orders?status=new|active|history`
- `POST /cook/orders/{id}/accept` → accepted+preparing · `/reject` {reason} → cancelled · `/ready` → ready
- `GET /cook/earnings` — period summaries + payout history
- **Onboarding wizard (5 steps, resumable):**
  - `GET /meal-types` — public; cuisine options for step 2
  - `GET /cook/onboarding` — current step, every saved answer, documents, and the four status rows
  - `PUT /cook/onboarding/step/{2|3|4}` — save business / legal / payment+billing. Saving step 4 also creates the matching payout account in `tblcookbankaccounts` (matched on IBAN, so re-saving corrects it rather than duplicating); it stands aside once the cook has added accounts of their own.
  - `POST /cook/onboarding/documents` — multipart: cnic_front, cnic_back, bank_proof, menu_picture
  - `POST /cook/onboarding/submit` — requires all four documents; sets documents → `under_review`
  - Step 1 is `POST /auth/register` (cooks no longer send business fields; step 2 collects them)
- `GET /cook/bank-accounts` — read-only; `meta.max_accounts` is the cap (2).  Payout accounts are no longer self-service: the account the platform sends money to is exactly what an attacker who got into the account would swap, and a cook cannot undo a wrong payout.
- `GET|POST /cook/bank-requests` · `DELETE /cook/bank-requests/{id}` — ask an admin to `add`, `update` or `remove` an account. Multipart; `add`/`update` must attach a `proof` photo of the cheque book or statement. One open request at a time (409 otherwise), and a cook may cancel one that has not been decided. `add` is refused at the cap, and `remove` is refused when it is the cook's only account — they must always have somewhere to be paid.

### Rider (role rider, active)
- `POST /rider/status/toggle` — online/offline
- `GET /rider/orders/available` — status ready, no rider (admin may also assign directly)
- `GET /rider/orders?status=ongoing|completed|cancelled` — ongoing = assigned `ready`/`on_the_way`, completed = `delivered` only; cancelled assignments remain separate and never count as delivered work
- `GET /rider/orders/{id}` — assigned rider only, including cancelled/completed orders; returns items and kitchen pickup area/city. Foreign/unassigned order → 404.
- `POST /rider/orders/{id}/accept` — self-assign → on_the_way after `/pickup`; `/pickup` sets picked_up_at; `/deliver` → delivered, cash_in_hand += total. Delivery status, COD cash and customer notification commit in one transaction; retrying an already delivered order assigned to the same rider returns success without collecting COD again.
- `GET /rider/earnings` — daily/weekly/monthly deliveries + fees, cash_in_hand, settlement history
- `GET|PUT /rider/profile` · `POST /rider/documents` (multipart). GET also returns `completion` = { percent, is_complete, sections[], missing[] }. PUT now accepts `cnic_number`, the CNIC address (`address_line`, `address_area`, `address_city`) and the emergency contact (`emergency_name`, `emergency_relationship`, `emergency_phone`, `emergency_alt_phone`).
- `POST /rider/safety/accept` — records that the safety guidelines were read
- **Profile gate:** a rider may not work until all five sections are complete (personal, vehicle + documents, address, emergency contact, safety). `POST /rider/status/toggle` (going online) and `POST /rider/orders/{id}/accept` return **403** with the checklist when incomplete. Going offline is always allowed.
- `GET /rider/deposit-account` — read-only platform account the rider banks collected cash into, plus their cash_in_hand and the weekly deadline. Riders never supply bank details of their own.

### Admin (role admin)
- `GET /admin/dashboard` — today's orders, GMV, pending cooks/riders, online riders, counts by status, recent orders
- `GET /admin/cooks?status=pending|active|blocked&search=` · `GET /admin/cooks/{id}` (docs + dishes)
- `POST /admin/cooks` — admin creates a cook: name, phone, password, email?, kitchen_name, city, area, bio?, status? (`active` by default, `pending` to queue for review)
- `POST /admin/cooks/{id}/approve | reject {reason} | block | unblock`
- `POST /admin/cooks/{id}/onboarding` — drives the cook's status screen: `{ contract: pending|sent|completed, documents: pending|under_review|approved|rejected, profile: locked|ready|completed, activation: locked|ready|active }`. Setting `activation: active` also activates the account and stamps `approved_at`. Each change notifies the cook.
- `POST /admin/dishes/{id}/hide | unhide`
- `GET /admin/riders?...` · `GET /admin/riders/{id}` · approve/reject/block/unblock (same shape)
- `POST /admin/riders` — admin creates a rider: name, phone, password, email?, city, vehicle_type, license_plate, cnic_number, vehicle_brand?, vehicle_model?, status?
- `GET /admin/customers?search=` · `POST /admin/customers/{id}/block | unblock`
- `GET /admin/orders?status=&search=` · `GET /admin/orders/{id}`
- `POST /admin/orders/{id}/assign-rider` {rider_id} · `POST /admin/orders/{id}/cancel` {reason}
- `GET /admin/bank-requests?status=pending|approved|rejected` · `POST /admin/bank-requests/{id}/approve` · `POST /admin/bank-requests/{id}/reject` {reason} — review payout account requests. Approving is what writes to `tblcookbankaccounts`: adding respects `make_default` (and always makes the cook's first account the default), updating can promote it, and removing promotes another so a cook is never left with accounts but nowhere to be paid. Rejecting requires a reason, which the cook sees.
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


## Order flow verification

`npm run test:integration` creates a uniquely named temporary database on local MySQL, runs real HTTP/model handoffs, cancellation/pickup races, notification rollback and COD retry tests, then drops only that database. It refuses remote `DB_HOST` values and never runs schema/reset against `DB_NAME`. The local DB user needs permission to create/drop a temporary database. `npm test` discovers the suite without opting into DB access.

The mobile apps use the existing refresh controls and pull-to-refresh to receive updated statuses. Database notifications are persisted; background push, GPS/ETA, refunds and rider timed-offer dispatch are not part of this flow. Self-accept claims an unassigned ready order; admin assignment is already accepted and awaits pickup. `delivered` is also the completed order state; no additional `completed` server transition is required.


## Customer website account and checkout endpoints

All endpoints below require a customer bearer token. These additions use the existing schema.

- `GET /auth/profile` and `PUT /auth/profile`: read/update the authenticated customer's `name`, `email`, and `phone`. Keep at least one contact identifier. Email/phone conflicts return 409; role, status, credentials and other fields cannot be changed here. Responses contain a sanitized user.
- `GET /customer/settings`: returns only `support_phone`, `service_areas`, `delivery_fee`, `tax_pct`, `discount_threshold`, `discount_amount`. Internal commission/payout configuration is excluded.
- `GET /customer/reviews`: saved reviews joined with `order_number` and `kitchen_name`, newest first.
- `POST /orders/quote`: `{cook_id,address_id,items:[{dish_id,quantity,variation_id?}],special_instructions?}`. No writes. Validates active customer and cook, an open kitchen, address ownership, available dishes from one cook, valid option IDs, integer quantities 1–99, and instructions up to 255 characters. Reads all prices/settings from the server and returns `{cook_id,kitchen_name,items,item_total,delivery_fee,tax,discount,total,payment_method:'cod',delivery_address,special_instructions}`. Each quoted item includes `variation_id`, `variation_name` and `serves` when applicable.
- `POST /orders` accepts the same selection plus optional `expected_total`. Placement recomputes canonical prices through the quote validator. A changed expected total returns 409 before any order is written. Legacy mobile submissions without option IDs continue to use the dish base price. Selected options are snapshotted into the existing item's `name` (for example `Biryani (Family)`) and canonical `price`; no mutable catalog price is used to render an old receipt.
- Order, items and the cook notification commit in one transaction. Public order numbers are serialized with a MySQL named lock. A network/5xx response is uncertain to the caller: reconcile order history before submitting another order.
- `GET /orders` includes `items`, `review: {stars,comment,created_at} | null`, and `has_review`. `GET /orders/:id` includes the same review fields. Reviews persist across devices. Rate requests accept integer stars 1–5 and comments up to 1,000 characters.
