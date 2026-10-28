const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Never run schema/reset against the configured project database. These tests
// create and drop their own unique database, and refuse remote hosts.
describe('Order flow (isolated local MySQL)', { skip: process.env.RUN_DB_TESTS !== '1' }, () => {
  let admin, pool, orders, notifications, server, baseUrl;
  const database = `hometiffin_test_${process.pid}_${Date.now()}`;
  const jwt = require('jsonwebtoken');
  const secret = 'isolated-order-flow-test-secret';
  const token = (id, role) => jwt.sign({ id, role }, secret);
  const request = async (url, id = 1, role = 'customer', method = 'POST', body = {}) => {
    const result = await fetch(baseUrl + url, {
      method, headers: { Authorization: `Bearer ${token(id, role)}`, 'Content-Type': 'application/json' },
      ...(!['GET', 'HEAD'].includes(method) ? { body: JSON.stringify(body) } : {}),
    });
    return { status: result.status, body: await result.json() };
  };
  let nextOrderNumber = 2000;
  const checkout = (overrides = {}) => ({ cook_id: 2, address_id: 10,
    items: [{ dish_id: 20, quantity: 2, variation_id: 201 }], ...overrides });
  const counts = async () => {
    const [[row]] = await pool.query(`SELECT
      (SELECT COUNT(*) FROM tblorders) AS orders,
      (SELECT COUNT(*) FROM tblorderitems) AS items,
      (SELECT COUNT(*) FROM tblnotifications) AS notifications`);
    return row;
  };
  const insertOrder = async (status = 'ready', riderId = 3) => {
    const [result] = await pool.query(`INSERT INTO tblorders
      (order_number,customer_id,cook_id,rider_id,delivery_address,status,item_total,delivery_fee,total,payment_method)
      VALUES (?,1,2,?,? ,?,1000,100,1100,'cod')`,
      [nextOrderNumber++, riderId, JSON.stringify({ address: 'Test address' }), status]);
    return result.insertId;
  };
  before(async () => {
    require('dotenv').config({ quiet: true });
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Integration tests require a local DB_HOST');
    const mysql = require('mysql2/promise');
    admin = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER,
      password: process.env.DB_PASSWORD, port: Number(process.env.DB_PORT || 3306), multipleStatements: true });
    await admin.query(`CREATE DATABASE \`${database}\``);
    process.env.DB_NAME = database;
    process.env.JWT_SECRET = secret;
    await admin.query(`USE \`${database}\``);
    const [[selected]] = await admin.query('SELECT DATABASE() AS name');
    assert.equal(selected.name, database, 'Schema must only run in the unique test database');
    await admin.query(fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8'));
    // Bring only this isolated schema up to the catalog/profile version the
    // application reads. Never run the project reset/seed helpers here.
    for (const migration of ['20261016_cook_onboarding_wizard.sql', '20261016_dish_items.sql',
      '20261017_dish_slots_contents.sql', '20261017_variation_serves.sql', '20261017_social_signin.sql']) {
      await admin.query(fs.readFileSync(path.join(__dirname, '../migrations', migration), 'utf8'));
    }
    pool = require('../config/db');
    orders = require('../models/orderModel');
    notifications = require('../models/notificationModel');
    const password = require('bcryptjs').hashSync('Test-password-123!', 4);
    await pool.query(`INSERT INTO tblusers (id,name,phone,password,role) VALUES
      (1,'Customer','03000000001',?,'customer'),(2,'Cook','03000000002',?,'cook'),
      (3,'Rider','03000000003',?,'rider'),(4,'Other customer','03000000004',?,'customer'),
      (5,'Other cook','03000000005',?,'cook')`, Array(5).fill(password));
    await pool.query(`INSERT INTO tblcookprofiles (user_id,kitchen_name,city,area) VALUES
      (2,'Test home kitchen','Islamabad','F-8'),(5,'Another kitchen','Lahore','Gulberg')`);
    await pool.query(`INSERT INTO tbladdresses
      (id,user_id,label,full_name,phone,address,area,city,is_default,delivery_instructions) VALUES
      (10,1,'Home','Customer','03000000001','Test street','F-8','Islamabad',1,'Ring the bell'),
      (11,4,'Home','Other customer','03000000004','Other street','G-9','Islamabad',1,NULL)`);
    await pool.query(`INSERT INTO tbldishes
      (id,cook_id,name,category,price,is_veg,serves) VALUES
      (20,2,'Biryani','Biryani & Pulao',400,0,'1 person'),
      (21,2,'Daal','Daal & Sabzi',250,1,'1 person'),
      (22,5,'Other kitchen meal','Daal & Sabzi',300,1,'1 person')`);
    await pool.query(`INSERT INTO tbldishvariations (id,dish_id,name,price,serves) VALUES
      (201,20,'Family',900,'3 people'),(202,20,'Regular',500,'1 person')`);
    await pool.query(`INSERT INTO tblriderprofiles
      (user_id,city,vehicle_type,license_plate,cnic_number) VALUES (3,'Karachi','bike','TEST','TEST')`);
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use('/orders', require('../routes/orderRoutes'));
    app.use('/rider', require('../routes/riderRoutes'));
    app.use('/cook', require('../routes/cookRoutes'));
    app.use('/auth', require('../routes/authRoutes'));
    app.use('/customer', require('../routes/customerRoutes'));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
      await admin.end();
    }
  });
  beforeEach(async () => {
    await pool.query('DELETE FROM tblorders');
    await pool.query('DELETE FROM tblnotifications');
    await pool.query('UPDATE tblriderprofiles SET cash_in_hand = 0');
    await pool.query(`UPDATE tblusers SET status='active'`);
    await pool.query(`UPDATE tblusers SET name='Customer',phone='03000000001',email=NULL,role='customer' WHERE id=1`);
    await pool.query(`UPDATE tblcookprofiles SET is_kitchen_open=1,rating=0,total_reviews=0`);
    await pool.query(`UPDATE tbldishes SET is_available=1,is_hidden=0`);
    await pool.query(`UPDATE tbldishes SET name='Biryani',price=400 WHERE id=20`);
    await pool.query(`UPDATE tbldishvariations SET name='Family',price=900 WHERE id=201`);
    await pool.query(`UPDATE tbladdresses SET address='Test street',delivery_instructions='Ring the bell' WHERE id=10`);
    await pool.query(`INSERT INTO tblsettings
      (id,delivery_fee,tax_pct,discount_threshold,discount_amount,service_areas,support_phone)
      VALUES (1,50,5,1000,100,?,'03001234567')
      ON DUPLICATE KEY UPDATE delivery_fee=50,tax_pct=5,discount_threshold=1000,discount_amount=100,
        service_areas=VALUES(service_areas),support_phone=VALUES(support_phone)`,
      [JSON.stringify(['Islamabad', 'Rawalpindi'])]);
  });

  it('quotes selected catalog options without writes and places the same authoritative totals once', async () => {
    const body = checkout({ items: [{ dish_id:20, quantity:2, variation_id:201, price:1, name:'Client override' }],
      special_instructions:' Less spicy ', payment_method:'card', total:1 });
    const quote = await request('/orders/quote', 1, 'customer', 'POST', body);
    assert.equal(quote.status, 200);
    assert.deepEqual(await counts(), {orders:0,items:0,notifications:0});
    assert.equal(quote.body.data.customer_id, undefined);
    assert.equal(quote.body.data.item_total, 1800);
    assert.equal(quote.body.data.delivery_fee, 50);
    assert.equal(quote.body.data.tax, 90);
    assert.equal(quote.body.data.discount, 100);
    assert.equal(quote.body.data.total, 1840);
    assert.equal(quote.body.data.items[0].variation_name, 'Family');
    assert.equal(quote.body.data.items[0].serves, '3 people');
    const placed = await request('/orders', 1, 'customer', 'POST', {...body, expected_total:1840});
    assert.equal(placed.status, 201);
    const order = placed.body.data;
    assert.equal(order.status, 'new');
    assert.equal(order.total, quote.body.data.total);
    assert.equal(order.payment_method, 'cod');
    assert.equal(order.special_instructions, 'Less spicy');
    assert.equal(order.items[0].name, 'Biryani (Family)');
    assert.equal(order.items[0].price, 900);
    assert.equal(order.items[0].quantity, 2);
    assert.equal(order.has_review, false);
    assert.equal(order.review, null);
    assert.deepEqual(await counts(), {orders:1,items:1,notifications:1});
    const [notices] = await pool.query('SELECT user_id,title FROM tblnotifications');
    assert.deepEqual(notices, [{user_id:2,title:`New Order #${order.order_number}`}]);
  });

  it('rejects a changed expected total before any order, item or notification is persisted', async () => {
    const quote = await request('/orders/quote', 1, 'customer', 'POST', checkout());
    await pool.query('UPDATE tblsettings SET delivery_fee=75 WHERE id=1');
    const result = await request('/orders', 1, 'customer', 'POST', checkout({expected_total:quote.body.data.total}));
    assert.equal(result.status, 409);
    assert.match(result.body.message, /total has changed/i);
    assert.deepEqual(await counts(), {orders:0,items:0,notifications:0});
    const updated = await request('/orders/quote', 1, 'customer', 'POST', checkout());
    assert.equal(updated.body.data.total, quote.body.data.total + 25);
  });

  it('keeps option names, prices and delivery-address snapshots after the catalog changes', async () => {
    const placed = await request('/orders', 1, 'customer', 'POST', checkout());
    assert.equal(placed.status, 201);
    const id = placed.body.data.id;
    await pool.query(`UPDATE tbldishes SET name='Renamed meal',price=999 WHERE id=20`);
    await pool.query(`UPDATE tbldishvariations SET name='Updated option',price=1200 WHERE id=201`);
    await pool.query(`UPDATE tbladdresses SET address='Changed address' WHERE id=10`);
    const detail = await request(`/orders/${id}`, 1, 'customer', 'GET');
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.items[0].name, 'Biryani (Family)');
    assert.equal(detail.body.data.items[0].price, 900);
    const address = typeof detail.body.data.delivery_address === 'string'
      ? JSON.parse(detail.body.data.delivery_address) : detail.body.data.delivery_address;
    assert.equal(address.address, 'Test street');
    assert.equal(address.delivery_instructions, 'Ring the bell');
    const list = await request('/orders', 1, 'customer', 'GET');
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].items[0].name, 'Biryani (Family)');
    assert.equal(list.body.data[0].review, null);
    assert.equal((await request('/orders', 4, 'customer', 'GET')).body.data.length, 0);
    assert.equal((await request(`/orders/${id}`, 4, 'customer', 'GET')).status, 404);
  });

  it('guards checkout, history, profile and customer settings by authentication and role', async () => {
    const id = await insertOrder('delivered');
    const endpoints = [['/orders/quote','POST'],['/orders','POST'],['/orders','GET'],
      [`/orders/${id}`,'GET'],[`/orders/${id}/rate`,'POST'],['/auth/profile','GET'],
      ['/auth/profile','PUT'],['/customer/settings','GET'],['/customer/reviews','GET']];
    for (const [url, method] of endpoints) {
      assert.equal((await fetch(baseUrl+url,{method})).status, 401, `${method} ${url} requires authentication`);
      for (const [userId, role] of [[2,'cook'],[3,'rider']]) {
        assert.equal((await request(url,userId,role,method,checkout())).status, 403, `${role} cannot ${method} ${url}`);
      }
    }
  });

  it('refuses foreign addresses, mixed kitchens, unavailable dishes and inactive accounts at checkout', async () => {
    assert.equal((await request('/orders/quote',1,'customer','POST',checkout({address_id:11}))).status, 400);
    assert.equal((await request('/orders',1,'customer','POST',checkout({items:[{dish_id:22,quantity:1}]}))).status, 400);
    await pool.query('UPDATE tbldishes SET is_hidden=1 WHERE id=20');
    assert.equal((await request('/orders',1,'customer','POST',checkout())).status, 400);
    await pool.query('UPDATE tbldishes SET is_hidden=0 WHERE id=20');
    await pool.query('UPDATE tblcookprofiles SET is_kitchen_open=0 WHERE user_id=2');
    assert.equal((await request('/orders',1,'customer','POST',checkout())).status, 400);
    await pool.query('UPDATE tblcookprofiles SET is_kitchen_open=1 WHERE user_id=2');
    await pool.query("UPDATE tblusers SET status='blocked' WHERE id=1");
    assert.equal((await request('/orders',1,'customer','POST',checkout())).status, 403);
    assert.deepEqual(await counts(), {orders:0,items:0,notifications:0});
  });

  it('persists only the customer’s allowed profile fields without exposing credentials or privileges', async () => {
    const updated = await request('/auth/profile',1,'customer','PUT',{
      name:'Updated Customer',email:'customer@example.test',phone:'+923001112233',
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.name, 'Updated Customer');
    assert.equal(updated.body.data.email, 'customer@example.test');
    assert.equal(updated.body.data.phone, '+923001112233');
    assert.equal(updated.body.data.password, undefined);
    assert.equal(updated.body.data.provider_user_id, undefined);
    assert.equal(updated.body.data.role, 'customer');
    const persisted = await request('/auth/profile',1,'customer','GET');
    assert.equal(persisted.body.data.name, 'Updated Customer');
    for (const forbidden of [{role:'admin'},{status:'active'},{password:'replacement'},{id:4}]) {
      assert.equal((await request('/auth/profile',1,'customer','PUT',forbidden)).status, 400);
    }
    assert.equal((await request('/auth/profile',1,'customer','PUT',{phone:'03000000004'})).status, 409);
    const [[customer]] = await pool.query('SELECT name,email,phone,role,status,password FROM tblusers WHERE id=1');
    assert.equal(customer.role, 'customer');
    assert.equal(customer.status, 'active');
    assert.equal(customer.phone, '+923001112233');
    assert.ok(await require('bcryptjs').compare('Test-password-123!',customer.password));
    const other = await request('/auth/profile',4,'customer','GET');
    assert.equal(other.body.data.name, 'Other customer');
    await pool.query("UPDATE tblusers SET status='blocked' WHERE id=1");
    assert.equal((await request('/auth/profile',1,'customer','PUT',{name:'Blocked update'})).status, 403);
    assert.equal((await request('/auth/profile',1,'customer','GET')).status, 403);
  });

  it('returns customer support and pricing settings without internal commission configuration', async () => {
    const result = await request('/customer/settings',1,'customer','GET');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data,{support_phone:'03001234567',delivery_fee:50,tax_pct:'5.00',
      discount_threshold:1000,discount_amount:100,service_areas:['Islamabad','Rawalpindi']});
    assert.equal(result.body.data.commission_pct, undefined);
    await pool.query('DELETE FROM tblsettings');
    assert.equal((await request('/customer/settings',1,'customer','GET')).status, 503);
  });

  it('persists a delivered order review and exposes it consistently in detail, history and personal reviews', async () => {
    const id = await insertOrder('delivered');
    const pending = await insertOrder('new');
    assert.equal((await request(`/orders/${pending}/rate`,1,'customer','POST',{stars:5})).status, 400);
    assert.equal((await request(`/orders/${id}/rate`,4,'customer','POST',{stars:5})).status, 404);
    assert.equal((await request(`/orders/${id}/rate`,1,'customer','POST',{stars:2.5})).status, 400);
    assert.equal((await request(`/orders/${id}/rate`,1,'customer','POST',{stars:5,comment:'x'.repeat(1001)})).status, 400);
    const result = await request(`/orders/${id}/rate`,1,'customer','POST',{stars:4,comment:'Lovely homemade meal'});
    assert.equal(result.status, 201);
    const detail = await request(`/orders/${id}`,1,'customer','GET');
    assert.equal(detail.body.data.has_review, true);
    assert.equal(detail.body.data.review.stars, 4);
    assert.equal(detail.body.data.review.comment, 'Lovely homemade meal');
    assert.ok(detail.body.data.review.created_at);
    const list = await request('/orders',1,'customer','GET');
    assert.equal(list.body.data.find(order=>order.id===id).review.stars, 4);
    assert.equal(list.body.data.find(order=>order.id===pending).has_review, false);
    const reviews = await request('/customer/reviews',1,'customer','GET');
    assert.equal(reviews.body.data.length, 1);
    assert.equal(reviews.body.data[0].order_id, id);
    assert.equal(reviews.body.data[0].kitchen_name, 'Test home kitchen');
    assert.equal((await request('/customer/reviews',4,'customer','GET')).body.data.length, 0);
    assert.equal((await request(`/orders/${id}/rate`,1,'customer','POST',{stars:1})).status, 400);
    const [[count]] = await pool.query('SELECT COUNT(*) AS count FROM tblreviews WHERE order_id=?',[id]);
    assert.equal(count.count, 1);
    const [[kitchen]] = await pool.query('SELECT rating,total_reviews FROM tblcookprofiles WHERE user_id=2');
    assert.equal(Number(kitchen.rating), 4);
    assert.equal(kitchen.total_reviews, 1);
  });

  it('allocates unique public numbers and exactly one cook notification per concurrent checkout', async () => {
    const results = await Promise.all(Array.from({length:4},()=>request('/orders',1,'customer','POST',checkout())));
    assert.ok(results.every(result=>result.status===201),JSON.stringify(results.map(result=>result.status)));
    assert.equal(new Set(results.map(result=>result.body.data.order_number)).size, 4);
    assert.deepEqual(await counts(), {orders:4,items:4,notifications:4});
    const [notices] = await pool.query('SELECT title,COUNT(*) AS count FROM tblnotifications GROUP BY title');
    assert.ok(notices.every(notice=>notice.count===1));
  });

  it('rolls placement, items and cook notification back together and releases its checkout lock on failure', async () => {
    const original = notifications.createNotification;
    notifications.createNotification = async (...args) => {
      await original(...args);
      throw new Error('simulated notification persistence failure');
    };
    try {
      const failed = await request('/orders',1,'customer','POST',checkout());
      assert.equal(failed.status, 500);
    } finally { notifications.createNotification = original; }
    assert.deepEqual(await counts(), {orders:0,items:0,notifications:0});
    const retry = await request('/orders',1,'customer','POST',checkout());
    assert.equal(retry.status, 201);
    assert.deepEqual(await counts(), {orders:1,items:1,notifications:1});
  });

  it('requires authentication, customer role and ownership', async () => {
    const id = await insertOrder();
    assert.equal((await fetch(`${baseUrl}/orders/${id}/cancel`, { method: 'POST' })).status, 401);
    assert.equal((await request(`/orders/${id}/cancel`, 3, 'rider')).status, 403);
    assert.equal((await request(`/orders/${id}/cancel`, 4)).status, 404);
    assert.equal((await request('/orders/invalid/cancel')).status, 400);
    assert.equal((await orders.getById(id)).status, 'ready');
  });

  it('cancels all pre-pickup states, preserves assignment, and retries without duplicate notices', async () => {
    for (const status of ['new', 'accepted', 'preparing', 'ready']) {
      for (const riderId of [null, 3]) {
        const id = await insertOrder(status, riderId);
        const first = await request(`/orders/${id}/cancel`);
        assert.equal(first.status, 200);
        assert.equal(first.body.data.status, 'cancelled');
        assert.equal(first.body.data.cancelled_by, 'customer');
        assert.equal(first.body.data.rider_id, riderId);
        assert.equal(first.body.data.cancel_reason, null);
        assert.equal(first.body.data.total, 1100);
        const [notices] = await pool.query('SELECT user_id FROM tblnotifications WHERE title = ?', [`Order #${first.body.data.order_number} cancelled`]);
        assert.deepEqual(notices.map(n => n.user_id).sort(), riderId ? [1, 2, 3] : [1, 2]);
        const [[before]] = await pool.query('SELECT COUNT(*) AS count FROM tblnotifications');
        const retry = await request(`/orders/${id}/cancel`);
        assert.equal(retry.status, 200);
        const [[after]] = await pool.query('SELECT COUNT(*) AS count FROM tblnotifications');
        assert.equal(after.count, before.count);
        assert.ok(first.body.data.cancelled_at);
      }
    }
  });

  it('returns current order on pickup/terminal conflicts without cancelling it', async () => {
    for (const status of ['on_the_way', 'delivered', 'cancelled']) {
      const id = await insertOrder(status);
      const response = await request(`/orders/${id}/cancel`);
      assert.equal(response.status, 409);
      assert.equal(response.body.data.status, status);
    }
    const id = await insertOrder();
    await pool.query('UPDATE tblorders SET picked_up_at = NOW() WHERE id = ?', [id]);
    assert.equal((await request(`/orders/${id}/cancel`)).status, 409);
  });

  it('serializes concurrent cancellation and pickup: exactly one wins', async () => {
    for (let i = 0; i < 20; i++) {
      const id = await insertOrder();
      const actions = i % 2
        ? [orders.cancelByCustomer(id, 1), orders.pickupByRider(id, 3)]
        : [orders.pickupByRider(id, 3), orders.cancelByCustomer(id, 1)];
      const results = await Promise.all(actions);
      const cancellation = results[i % 2 ? 0 : 1];
      const pickup = results[i % 2 ? 1 : 0];
      assert.equal(Number(cancellation === 'cancelled') + Number(pickup.affectedRows === 1), 1);
      const current = await orders.getById(id);
      if (current.status === 'cancelled') assert.equal(current.picked_up_at, null);
      else assert.equal(current.status, 'on_the_way');
    }
  });

  it('removes cancelled jobs from pool and ongoing; keeps them out of completed and COD', async () => {
    const id = await insertOrder();
    await request(`/orders/${id}/cancel`);
    assert.equal((await orders.listAvailableForRiders()).length, 0);
    assert.equal((await orders.listByRider(3, 'ongoing')).length, 0);
    assert.equal((await orders.listByRider(3, 'completed')).length, 0);
    assert.equal((await orders.listByRider(3, 'cancelled')).length, 1);
    assert.equal((await request(`/rider/orders/${id}/pickup`, 3, 'rider')).status, 400);
    assert.equal((await request(`/rider/orders/${id}/deliver`, 3, 'rider')).status, 400);
    const [[profile]] = await pool.query('SELECT cash_in_hand FROM tblriderprofiles WHERE user_id=3');
    assert.equal(profile.cash_in_hand, 0);
  });

  it('rolls cancellation back if notification persistence fails', async () => {
    const id = await insertOrder();
    const original = notifications.createNotification;
    notifications.createNotification = async () => { throw new Error('simulated write failure'); };
    try { await assert.rejects(orders.cancelByCustomer(id, 1), /simulated/); }
    finally { notifications.createNotification = original; }
    const current = await orders.getById(id);
    assert.equal(current.status, 'ready');
    assert.equal(current.cancelled_at, null);
  });

  it('completes the cook/rider/customer handoffs and collects COD only once on concurrent retry', async () => {
    const id = await insertOrder('new', null);
    assert.equal((await request(`/cook/orders/${id}/accept`, 2, 'cook')).status, 200);
    assert.equal((await orders.getById(id)).status, 'preparing');
    assert.equal((await request(`/cook/orders/${id}/ready`, 2, 'cook')).status, 200);
    assert.equal((await orders.listAvailableForRiders()).length, 1);
    assert.equal((await orders.assignRider(id, 3)).affectedRows, 1);
    assert.equal((await orders.assignRider(id, 3)).affectedRows, 0);
    assert.equal((await request(`/rider/orders/${id}`, 3, 'rider', 'GET')).status, 200);
    assert.equal((await request(`/rider/orders/${id}`, 4, 'rider', 'GET')).status, 404);
    assert.equal((await request(`/rider/orders/${id}/pickup`, 3, 'rider')).status, 200);
    assert.equal((await request(`/orders/${id}/cancel`)).status, 409);
    const delivered = await Promise.all([
      request(`/rider/orders/${id}/deliver`, 3, 'rider'), request(`/rider/orders/${id}/deliver`, 3, 'rider'),
    ]);
    assert.ok(delivered.every(response => response.status === 200));
    const current = await request(`/orders/${id}`, 1, 'customer', 'GET');
    assert.equal(current.body.data.status, 'delivered');
    const [[profile]] = await pool.query('SELECT cash_in_hand FROM tblriderprofiles WHERE user_id=3');
    assert.equal(profile.cash_in_hand, 1100);
    assert.equal((await orders.listByRider(3, 'completed')).length, 1);
  });

  it('serializes assignment with cancellation and notifies a rider only when assigned', async () => {
    for (let i = 0; i < 10; i++) {
      const id = await insertOrder('ready', null);
      const [assigned, cancelled] = await Promise.all([
        orders.assignRider(id, 3), orders.cancelByCustomer(id, 1),
      ]);
      assert.equal(cancelled, 'cancelled');
      const order = await orders.getById(id);
      assert.equal(order.status, 'cancelled');
      assert.equal(order.rider_id, assigned.affectedRows ? 3 : null);
      const [notices] = await pool.query('SELECT * FROM tblnotifications WHERE user_id = 3 AND title = ?', [`Order #${order.order_number} cancelled`]);
      assert.equal(notices.length, assigned.affectedRows ? 1 : 0);
    }
  });

  it('admin cancellation preserves its broader privilege and notifies all assigned roles atomically', async () => {
    const id = await insertOrder('on_the_way');
    assert.equal((await orders.cancelByAdmin(id, 'Kitchen issue')).affectedRows, 1);
    const order = await orders.getById(id);
    assert.equal(order.status, 'cancelled');
    assert.equal(order.cancelled_by, 'admin');
    assert.equal(order.cancel_reason, 'Kitchen issue');
    const [notices] = await pool.query('SELECT user_id FROM tblnotifications');
    assert.deepEqual(notices.map(n => n.user_id).sort(), [1, 2, 3]);
    const delivered = await insertOrder('delivered');
    assert.equal((await orders.cancelByAdmin(delivered, 'Too late')).affectedRows, 0);
  });

  it('rolls delivery and COD back together if notification persistence fails', async () => {
    const id = await insertOrder('on_the_way');
    const original = notifications.createNotification;
    notifications.createNotification = async () => { throw new Error('simulated write failure'); };
    try { await assert.rejects(orders.deliverByRider(id, 3), /simulated/); }
    finally { notifications.createNotification = original; }
    assert.equal((await orders.getById(id)).status, 'on_the_way');
    const [[profile]] = await pool.query('SELECT cash_in_hand FROM tblriderprofiles WHERE user_id=3');
    assert.equal(profile.cash_in_hand, 0);
    await orders.deliverByRider(id, 3);
    const [[retryProfile]] = await pool.query('SELECT cash_in_hand FROM tblriderprofiles WHERE user_id=3');
    assert.equal(retryProfile.cash_in_hand, 1100);
  });
});
