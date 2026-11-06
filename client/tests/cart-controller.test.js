import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate as tick } from "node:timers/promises";
import { createCartController } from "../src/services/cart-controller.js";

const product = (id = 1) => ({ id, sku: "DEMO-"+id, name: "Demo "+id, images: [{path:"/demo.png"}], effective_price_cents: 1000, available_quantity: 100, is_available: true, version: 1, inventory_version: 1 });
const line = (id = 1, quantity = 1) => ({ product_id: id, sku: "DEMO-"+id, name: "Demo "+id, image: "/demo.png", quantity, unit_price_cents: 1000, line_total_cents: 1000*quantity, available_quantity: 100, available: true, issue: null });
const cart = (items = []) => ({ cartId: 1, version: 1, items, total_cents: items.reduce((n,i)=>n+i.line_total_cents,0), subtotal_cents: items.reduce((n,i)=>n+i.line_total_cents,0), issues: [], currency: "PEN" });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
function fixture(initial = cart()) {
  let server = structuredClone(initial), loads = 0, writes = [], concurrent = 0, maximum = 0;
  const gates = [], failures = [];
  const store = createCartController({
    load: async () => { loads++; return structuredClone(server); },
    write: async (id,n,version) => {
      concurrent++; maximum=Math.max(maximum,concurrent); writes.push({id,n,version});
      try {
        if(gates.length) await gates.shift().promise;
        if(failures.length) { const failure=failures.shift(); if(failure.before)failure.before(); if(!failure.after)throw failure.error; }
        if(version!==server.version) throw Object.assign(Error("changed"),{status:409,code:"VERSION_CONFLICT"});
        const items=server.items.filter(i=>i.product_id!==id); if(n)items.push(line(id,n));
        server={...cart(items),version:server.version+1};
        return structuredClone(server);
      } finally { concurrent--; }
    },
  });
  return {store,gates,failures,get server(){return server;},set server(v){server=v;},get loads(){return loads;},get writes(){return writes;},get maximum(){return maximum;}};
}

test("add publishes line, total and pending synchronously without a pre-read", async () => {
  const f=fixture();await f.store.refresh();const gate=deferred();f.gates.push(gate);
  const saved=f.store.add(product());
  assert.equal(f.store.getSnapshot().cart.items[0].quantity,1);assert.equal(f.store.getSnapshot().cart.total_cents,1000);assert.equal(f.store.getSnapshot().pending,true);
  await tick();assert.equal(f.writes.length,1);assert.equal(f.loads,1);
  gate.resolve();await saved;await f.store.flush();assert.equal(f.store.getSnapshot().pending,false);assert.equal(f.server.items.length,1);
});
test("rapid relative intents coalesce and stay visible as earlier responses arrive", async () => {
  const f=fixture();await f.store.refresh();const gate=deferred();f.gates.push(gate);
  const jobs=[f.store.add(product())];await tick();
  for(let i=0;i<9;i++)jobs.push(f.store.add(product()));
  for(let i=0;i<4;i++)jobs.push(f.store.adjust(1,-1));
  assert.equal(f.store.getSnapshot().cart.items[0].quantity,6);
  gate.resolve();await Promise.all(jobs);await f.store.flush();
  assert.equal(f.server.items[0].quantity,6);assert.equal(f.server.items.length,1);assert.equal(f.maximum,1);assert.ok(f.writes.length<=2);
});
test("different products preserve FIFO and global cart versions", async () => {
  const f=fixture();await f.store.refresh();const gate=deferred();f.gates.push(gate);
  const first=f.store.add(product());await tick();const rest=[f.store.add(product(2)),f.store.adjust(1,1)];
  gate.resolve();await Promise.all([first,...rest]);await f.store.flush();
  assert.deepEqual(f.writes.map(w=>w.version),[1,2,3]);assert.equal(f.maximum,1);assert.equal(f.server.items.find(i=>i.product_id===1).quantity,2);
});
test("remove then re-add before sending preserves one final line", async () => {
  const f=fixture(cart([line()]));await f.store.refresh();
  const gone=f.store.quantity(1,0);assert.equal(f.store.getSnapshot().cart.items.length,0);
  const back=f.store.add(product());assert.equal(f.store.getSnapshot().cart.items.length,1);
  await Promise.all([gone,back]);await f.store.flush();assert.equal(f.server.items[0].quantity,1);assert.equal(f.server.items.length,1);
});
test("a rejected write rolls back and refreshes; checkout remains blocked until review", async () => {
  const f=fixture(cart([line()]));await f.store.refresh();
  f.failures.push({error:Object.assign(Error("Stock changed"),{status:409,code:"OUT_OF_STOCK"})});
  await assert.rejects(f.store.adjust(1,1),{code:"OUT_OF_STOCK"});await assert.rejects(f.store.flush());
  assert.equal(f.store.getSnapshot().cart.items[0].quantity,1);assert.equal(f.writes.length,1);assert.equal(f.loads,2);
  await f.store.refresh();assert.equal(f.store.getSnapshot().error,null);assert.equal((await f.store.flush()).items[0].quantity,1);
});
test("lost response after server commit reconciles once without repeating the delta", async () => {
  let server=cart(), writes=0, loads=0;
  const store=createCartController({load:async()=>{loads++;return structuredClone(server);},write:async(id,n)=>{writes++;server={...cart([line(id,n)]),version:2};throw Object.assign(Error("connection lost"),{code:"NETWORK"});}});
  await store.refresh();await assert.rejects(store.add(product()),{code:"NETWORK"});await assert.rejects(store.flush());
  assert.equal(server.items[0].quantity,1);assert.equal(store.getSnapshot().cart.items[0].quantity,1);assert.equal(writes,1);assert.equal(loads,2);
});
test("version conflict reloads and reapplies a relative intent only once", async () => {
  const f=fixture();await f.store.refresh();f.server={...cart([line(1,2)]),version:2};
  await f.store.add(product());await f.store.flush();assert.equal(f.server.items[0].quantity,3);assert.equal(f.writes.length,2);assert.equal(f.loads,2);
});
test("repeated version conflicts stop rather than looping", async () => {
  let reads=0,writes=0;const store=createCartController({load:async()=>{reads++;return cart();},write:async()=>{writes++;throw Object.assign(Error("changed"),{status:409,code:"VERSION_CONFLICT"});}});
  await store.refresh();await assert.rejects(store.add(product()));await assert.rejects(store.flush());assert.equal(writes,2);assert.ok(reads<=3);assert.equal(store.getSnapshot().pending,false);
});
test("late response from a reset generation cannot replace the new session cart", async () => {
  const gate=deferred();let source=cart();const store=createCartController({load:async()=>structuredClone(source),write:async()=>gate.promise});
  await store.refresh();const operation=store.add(product());const rejected=assert.rejects(operation,{code:"SESSION_CHANGED"});await tick();store.reset();
  source={...cart([line(2,3)]),cartId:99};await store.refresh();gate.resolve(cart([line()]));await rejected;await tick();
  assert.equal(store.getSnapshot().cart.cartId,99);assert.equal(store.getSnapshot().cart.items[0].product_id,2);assert.equal(store.getSnapshot().pending,false);
});
test("initial load rebases the optimistic add onto an existing persisted cart", async () => {
  const load=deferred();let written;
  const store=createCartController({load:async()=>load.promise,write:async(id,n)=>{written=n;return {...cart([line(id,n)]),version:2};}});
  const refresh=store.refresh();await tick();const action=store.add(product());assert.equal(store.getSnapshot().cart.items[0].quantity,1);
  load.resolve(cart([line(1,2)]));await Promise.all([refresh,action]);await store.flush();assert.equal(written,3);
});
test("quantity, stock and line limits reject locally without a request", async () => {
  const f=fixture(cart([line(1,99)]));await f.store.refresh();await assert.rejects(f.store.add(product()));assert.equal(f.writes.length,0);
  const g=fixture(cart([line()]));await g.store.refresh();await assert.rejects(g.store.add({...product(),available_quantity:1}));
  const many=fixture(cart(Array.from({length:100},(_,i)=>line(i+1))));await many.store.refresh();await assert.rejects(many.store.add(product(101)),{code:"CART_LIMIT"});assert.equal(many.writes.length,0);
});
test("server prices replace estimates and remaining intents use corrected prices", async () => {
  const gate=deferred();let writes=0;
  const store=createCartController({load:async()=>cart(),write:async(id,n)=>{if(!writes++)await gate.promise;return {...cart([{...line(id,n),unit_price_cents:1200,line_total_cents:n*1200}]),version:writes+1};}});
  await store.refresh();const first=store.add(product());await tick();const second=store.add(product());gate.resolve();await Promise.all([first,second]);
  assert.equal(store.getSnapshot().cart.total_cents,2400);assert.equal(store.getSnapshot().cart.items[0].quantity,2);
});
test("refresh waits for queued writes and returns the persisted cart", async () => {
  const f=fixture();await f.store.refresh();const gate=deferred();f.gates.push(gate);const job=f.store.add(product());await tick();
  let finished=false;const refreshed=f.store.refresh().then(c=>{finished=true;return c;});await tick();assert.equal(finished,false);assert.equal(f.loads,1);
  gate.resolve();await job;assert.equal((await refreshed).items[0].quantity,1);
});
test("session rejection rolls back without reading an anonymous cart", async () => {
  const f=fixture(cart([line()]));await f.store.refresh();f.failures.push({error:Object.assign(Error("session expired"),{status:403,code:"CSRF"})});
  await assert.rejects(f.store.adjust(1,1));await assert.rejects(f.store.flush());assert.equal(f.loads,1);assert.equal(f.store.getSnapshot().needsSync,true);assert.equal(f.store.getSnapshot().cart.items[0].quantity,1);
});
