const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createOrderPricing} = require('../services/orderPricing');
const fixture = overrides => {
  const data = {
    customer:{id:1,role:'customer',status:'active'}, cook:{id:2,role:'cook',status:'active'},
    kitchen:{user_id:2,kitchen_name:'Test home kitchen',is_kitchen_open:1},
    address:{id:3,user_id:1,address:'Test street',area:'F-8',city:'Islamabad'},
    dishes:[{id:10,cook_id:2,name:'Biryani',price:400,is_available:1,is_hidden:0,variations:[{id:101,name:'Family',price:900,serves:'3 people'}]}],
    settings:{delivery_fee:50,tax_pct:5,discount_threshold:1000,discount_amount:100}, ...overrides,
  };
  return createOrderPricing({
    users:{getUserById:async id=>Number(id)===1?data.customer:data.cook},
    kitchens:{getByUserId:async()=>data.kitchen}, addresses:{getById:async()=>data.address},
    dishes:{getByIds:async()=>data.dishes}, settings:{getSettings:async()=>data.settings},
  });
};
const body = {cook_id:2,address_id:3,items:[{dish_id:10,quantity:2,variation_id:101}]};

test('checkout prices selected catalog options and ignores client-supplied prices',async()=>{
  const quote = await fixture()(1,{...body,items:[{...body.items[0],price:1}],special_instructions:' Less spicy '});
  assert.equal(quote.item_total,1800);
  assert.equal(quote.tax,90);
  assert.equal(quote.discount,100);
  assert.equal(quote.total,1840);
  assert.equal(quote.items[0].name,'Biryani (Family)');
  assert.equal(quote.items[0].price,900);
  assert.equal(quote.items[0].serves,'3 people');
  assert.equal(quote.payment_method,'cod');
  assert.equal(quote.special_instructions,'Less spicy');
});

test('legacy mobile payloads retain base pricing and duplicates cannot bypass portion limits',async()=>{
  const quote=await fixture()(1,{...body,items:[{dish_id:10,quantity:1},{dish_id:10,quantity:2}]});
  assert.equal(quote.item_total,1200);
  assert.equal(quote.items.length,1);
  assert.equal(quote.items[0].quantity,3);
  assert.equal(quote.items[0].variation_id,null);
  await assert.rejects(fixture()(1,{...body,items:[{dish_id:10,quantity:90},{dish_id:10,quantity:20}]}),/99/);
});

test('checkout rejects malformed quantities, foreign options, hidden dishes, mixed cooks and foreign addresses',async()=>{
  for(const quantity of [0,-1,1.5,100,'abc']) await assert.rejects(fixture()(1,{...body,items:[{dish_id:10,quantity}]}));
  await assert.rejects(fixture()(1,{...body,items:[{dish_id:10,quantity:1,variation_id:999}]}),/option/);
  await assert.rejects(fixture({dishes:[{id:10,cook_id:9,is_available:1,price:400}]})(1,body),/same|selected kitchen/);
  await assert.rejects(fixture({dishes:[{id:10,cook_id:2,is_available:1,is_hidden:1,price:400}]})(1,body),/unavailable/);
  await assert.rejects(fixture({address:{user_id:99}})(1,body),/saved delivery addresses/);
});

test('checkout refuses blocked customers, closed kitchens and invalid configuration',async()=>{
  await assert.rejects(fixture({customer:{role:'customer',status:'blocked'}})(1,body),error=>error.status===403);
  await assert.rejects(fixture({kitchen:{is_kitchen_open:0}})(1,body),/closed/);
  await assert.rejects(fixture({settings:null})(1,body),error=>error.status===503);
  await assert.rejects(fixture({settings:{delivery_fee:-50}})(1,body),error=>error.status===503);
});

test('discount boundaries and tax rounding match the persisted order calculations',async()=>{
  const price=async itemPrice=>fixture({dishes:[{id:10,cook_id:2,name:'Meal',price:itemPrice,is_available:1,is_hidden:0}]})(1,{...body,items:[{dish_id:10,quantity:1}]});
  assert.equal((await price(1000)).discount,0);
  assert.equal((await price(1001)).discount,100);
  assert.equal((await price(251)).tax,13);
});


test('instruction validation follows the existing order snapshot column limit', async()=>{
  assert.equal((await fixture()(1,{...body,special_instructions:'x'.repeat(255)})).special_instructions.length,255);
  await assert.rejects(fixture()(1,{...body,special_instructions:'x'.repeat(256)}),/255/);
  await assert.rejects(fixture()(1,null),/valid checkout/);
});
