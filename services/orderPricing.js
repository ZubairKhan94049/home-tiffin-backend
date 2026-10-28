class OrderValidationError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const activeFlag = value => value === true || value === 1 || value === '1';

/** Shared by checkout preview and placement; prices always come from the catalog. */
function createOrderPricing({ users, addresses, dishes, settings, kitchens }) {
  return async function priceOrder(customerId, body = {}) {
    if (!body || typeof body !== 'object') throw new OrderValidationError('Enter valid checkout details.');
    if (!positiveId(body.cook_id) || !positiveId(body.address_id) || !Array.isArray(body.items) || !body.items.length || body.items.length > 50) {
      throw new OrderValidationError('Choose a kitchen, a delivery address and between 1 and 50 cart lines.');
    }
    for (const item of body.items) {
      if (!positiveId(item?.dish_id) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 99
        || item.variation_id != null && !positiveId(item.variation_id)) {
        throw new OrderValidationError('Each meal needs a valid ID, quantity between 1 and 99, and a valid option if selected.');
      }
    }
    if (body.special_instructions != null && (typeof body.special_instructions !== 'string' || body.special_instructions.length > 255)) {
      throw new OrderValidationError('Special instructions must be at most 255 characters.');
    }
    const [customer, cook, address, kitchen, catalog, config] = await Promise.all([
      users.getUserById(customerId), users.getUserById(Number(body.cook_id)), addresses.getById(Number(body.address_id)),
      kitchens.getByUserId(Number(body.cook_id)), dishes.getByIds([...new Set(body.items.map(item => Number(item.dish_id)))]), settings.getSettings(),
    ]);
    if (!customer || customer.role !== 'customer' || customer.status !== 'active') throw new OrderValidationError('An active customer account is required.', 403);
    if (!cook || cook.role !== 'cook' || cook.status !== 'active' || !kitchen) throw new OrderValidationError('This kitchen is not available.');
    if (!activeFlag(kitchen.is_kitchen_open)) throw new OrderValidationError('This kitchen is currently closed. Please choose another kitchen or try again when it opens.');
    if (!address || Number(address.user_id) !== Number(customerId)) throw new OrderValidationError('Choose one of your saved delivery addresses.');
    if (!config) throw new OrderValidationError('Checkout settings are unavailable. Please try again later.', 503);
    const numbers = ['delivery_fee', 'tax_pct', 'discount_threshold', 'discount_amount'];
    if (numbers.some(key => !Number.isFinite(Number(config[key])) || Number(config[key]) < 0)) throw new OrderValidationError('Checkout settings are unavailable. Please try again later.', 503);

    const byId = new Map(catalog.map(dish => [Number(dish.id), dish]));
    const lines = new Map();
    for (const item of body.items) {
      const dish = byId.get(Number(item.dish_id));
      if (!dish || Number(dish.cook_id) !== Number(body.cook_id)) throw new OrderValidationError('All cart items must belong to the selected kitchen.');
      if (!activeFlag(dish.is_available) || activeFlag(dish.is_hidden)) throw new OrderValidationError(`${dish.name} is currently unavailable.`);
      const variation = item.variation_id == null ? null : (dish.variations || []).find(option => Number(option.id) === Number(item.variation_id));
      if (item.variation_id != null && !variation) throw new OrderValidationError(`The selected option for ${dish.name} has changed. Remove it and choose the meal again.`);
      const price = Number(variation?.price ?? dish.price);
      if (!Number.isSafeInteger(price) || price <= 0) throw new OrderValidationError(`${dish.name} does not have a valid price.`);
      const key = `${dish.id}:${variation?.id || 'base'}`;
      const quantity = Number(item.quantity) + (lines.get(key)?.quantity || 0);
      if (quantity > 99) throw new OrderValidationError('A cart line cannot contain more than 99 portions.');
      const optionName = String(variation?.name || '').slice(0, 80);
      const name = variation ? `${String(dish.name).slice(0, 120 - optionName.length - 3)} (${optionName})` : dish.name;
      lines.set(key, { dish_id: Number(dish.id), name, price, quantity, is_veg: dish.is_veg || 0,
        variation_id: variation?.id || null, variation_name: variation?.name || null, serves: variation?.serves || dish.serves || null });
    }
    const items = [...lines.values()];
    const item_total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const delivery_fee = Number(config.delivery_fee);
    const tax = Math.round(item_total * Number(config.tax_pct) / 100);
    const discount = item_total > Number(config.discount_threshold)
      ? Math.min(Number(config.discount_amount), item_total + delivery_fee + tax) : 0;
    const total = item_total + delivery_fee + tax - discount;
    if (!Number.isSafeInteger(total) || total > 2147483647) throw new OrderValidationError('This cart is too large to place in one order.');
    const delivery_address = Object.fromEntries(['label', 'full_name', 'phone', 'address', 'area', 'city', 'latitude', 'longitude', 'delivery_instructions'].map(key => [key, address[key] ?? null]));
    return { cook_id: Number(body.cook_id), kitchen_name: kitchen.kitchen_name, customer_id: Number(customerId), items,
      item_total, delivery_fee, tax, discount, total, payment_method: 'cod', delivery_address,
      special_instructions: body.special_instructions?.trim() || null };
  };
}
module.exports = { createOrderPricing, OrderValidationError };
