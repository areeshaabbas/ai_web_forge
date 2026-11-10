import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';
import { connect } from './db.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { extractionService } from './ai.js';

test('sign up, sign in and payments persist to MongoDB with safeguards', async t => {
  const mongo=process.env.MONGODB_TEST_URI?null:await MongoMemoryReplSet.create({binary:{version:'7.0.24'},replSet:{count:1,args:['--nounixsocket','--setParameter','diagnosticDataCollectionEnabled=false']}});
  let store,server;
  t.after(async()=>{
    if (server) await new Promise(resolve=>server.close(resolve));
    try {if (store) await store.db.dropDatabase();}
    finally {await store?.client.close();await mongo?.stop();}
  });
  store=await connect({uri:process.env.MONGODB_TEST_URI||mongo.getUri(),name:'roshan_test_auth_'+Date.now()});
  server=createApp({store,demoMode:true,now:()=>new Date('2026-11-10T10:00:00Z'),extract:extractionService({apiKey:''})}).listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/api';
  async function api(path,{method='GET',token,demo,data,status=200}={}) {
    const headers={'Content-Type':'application/json'};
    if (token) headers.Authorization='Bearer '+token;
    if (demo) headers['x-demo-user']=String(demo);
    const response=await fetch(base+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
    const body=await response.json();
    assert.equal(response.status,status,path+' '+JSON.stringify(body));
    return body;
  }

  // ---- sign up ----
  const signup={name:'Areesha Abbas',email:'Areesha@Example.com',phone:'03169643819',password:'correct horse',role:'customer'};
  const created=await api('/auth/signup',{method:'POST',status:201,data:signup});
  assert.ok(created.token);
  assert.equal(created.user.email,'areesha@example.com');
  assert.ok(created.user.id>12,'new id must not collide with seeded users');
  assert.equal(created.user.passwordHash,undefined);
  const stored=await store.db.collection('users').findOne({_id:created.user.id});
  assert.match(stored.passwordHash,/^scrypt\$/);
  assert.ok(!JSON.stringify(stored).includes('correct horse'),'plain password must never be stored');
  await api('/auth/signup',{method:'POST',status:409,data:{...signup,email:'AREESHA@example.com'}});
  await api('/auth/signup',{method:'POST',status:422,data:{...signup,email:'x@example.com',password:'short'}});
  await api('/auth/signup',{method:'POST',status:422,data:{...signup,email:'not-an-email'}});
  await api('/auth/signup',{method:'POST',status:422,data:{...signup,email:'y@example.com',role:'admin'}});
  const workerAcct=await api('/auth/signup',{method:'POST',status:201,data:{name:'Usman Ali',email:'usman@example.com',password:'worker-pass-1',role:'worker'}});
  assert.equal(workerAcct.user.id,created.user.id+1);

  // ---- sign in ----
  await api('/auth/signin',{method:'POST',status:401,data:{email:'areesha@example.com',password:'wrong password'}});
  await api('/auth/signin',{method:'POST',status:401,data:{email:'nobody@example.com',password:'whatever1'}});
  const session=await api('/auth/signin',{method:'POST',data:{email:' AREESHA@example.com ',password:'correct horse'}});
  assert.equal(session.user.id,created.user.id);
  assert.equal((await api('/auth/me',{token:session.token})).name,'Areesha Abbas');
  await api('/auth/me',{status:401});
  await api('/auth/me',{token:session.token.slice(0,-2)+'xx',status:401});
  // tokens work for the real API, and real accounts are hidden from the demo picker
  assert.deepEqual(await api('/service-requests',{token:session.token}),[]);
  assert.ok(!(await api('/demo-users')).some(u=>u.id===created.user.id));
  await api('/service-requests',{demo:created.user.id,status:401}); // can't impersonate a real account via the demo header
  await api('/workers',{method:'POST',token:session.token,status:403,data:{}}); // customer can't create a worker profile

  // ---- booking set-up on the seeded confirmed booking (#10: Rs. 1500 + pending Rs. 450 extra, customer = Ayesha id 1) ----
  const b='/bookings/10';
  await api(b+'/payments',{method:'POST',demo:1,status:409,data:{method:'cash'}}); // pending extra blocks payment
  const open=await api(b,{demo:1});
  await api(b+'/addons/'+open.addons[0].id,{method:'PATCH',demo:1,data:{status:'APPROVED'}});
  const owed=await api(b+'/payments',{demo:1});
  assert.equal(owed.total,1950);
  assert.equal(owed.due,1950);

  const card={holder:'Ayesha Khan',number:'4242 4242 4242 4242',expiry:'12/29',cvv:'123'};
  await api(b+'/payments',{method:'POST',demo:3,status:403,data:{method:'card',card}}); // worker can't pay
  await api(b+'/payments',{method:'POST',demo:12,status:404,data:{method:'card',card}}); // other customer can't see the booking
  await api(b+'/payments',{method:'POST',demo:1,status:422,data:{method:'card',card:{...card,number:'4242 4242 4242 4241'}}}); // bad Luhn
  await api(b+'/payments',{method:'POST',demo:1,status:422,data:{method:'card',card:{...card,cvv:'12'}}});
  await api(b+'/payments',{method:'POST',demo:1,status:422,data:{method:'card',card:{...card,expiry:'13/29'}}});
  await api(b+'/payments',{method:'POST',demo:1,status:422,data:{method:'card',card:{...card,expiry:'09/26'}}}); // expired (clock is Nov 2026)
  await api(b+'/payments',{method:'POST',demo:1,status:422,data:{method:'bitcoin'}});
  await api(b+'/payments',{method:'POST',demo:1,status:422,data:{method:'jazzcash',wallet:{number:'12345'}}});

  const paid=await api(b+'/payments',{method:'POST',demo:1,status:201,data:{method:'card',card}});
  assert.equal(paid.payment.amount,1950);
  assert.equal(paid.payment.status,'PAID');
  assert.equal(paid.payment.card.last4,'4242');
  assert.equal(paid.payment.card.brand,'Visa');
  assert.equal(paid.due,0);
  const row=await store.db.collection('payments').findOne({_id:paid.payment.id});
  const dump=JSON.stringify(row);
  assert.ok(!dump.includes('4242424242424242')&&!dump.includes('4242 4242')&&!/"cvv"/.test(dump),'full card number / CVV must never be stored');
  await api(b+'/payments',{method:'POST',demo:1,status:409,data:{method:'cash'}}); // already fully paid
  const asWorker=await api(b+'/payments',{demo:3});
  assert.equal(asWorker.payments.length,1);
  assert.equal(asWorker.paid,1950);

  // a new extra after payment leaves only the balance due
  const extra=await api(b+'/addons',{method:'POST',demo:3,status:201,data:{description:'New switch',amount:300}});
  await api(b+'/addons/'+extra.addons.at(-1).id,{method:'PATCH',demo:1,data:{status:'APPROVED'}});
  const balance=await api(b+'/payments',{demo:1});
  assert.equal(balance.due,300);
  const wallet=await api(b+'/payments',{method:'POST',demo:1,status:201,data:{method:'easypaisa',wallet:{number:'0316 9643819'}}});
  assert.equal(wallet.payment.amount,300);
  assert.equal(wallet.payment.wallet.maskedNumber,'0316*****19');
  assert.equal(wallet.due,0);

  // simultaneous payments can't double-charge
  const more=await api(b+'/addons',{method:'POST',demo:3,status:201,data:{description:'Cover plate',amount:100}});
  await api(b+'/addons/'+more.addons.at(-1).id,{method:'PATCH',demo:1,data:{status:'APPROVED'}});
  const race=await Promise.all([0,1].map(()=>fetch(base+b+'/payments',{method:'POST',headers:{'x-demo-user':'1','Content-Type':'application/json'},body:JSON.stringify({method:'cash'})})));
  assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
  for (const r of race) await r.json();
  const final=await api(b+'/payments',{demo:1});
  assert.equal(final.paid+final.cashPending,2350);
  assert.equal(final.due,0);
});
