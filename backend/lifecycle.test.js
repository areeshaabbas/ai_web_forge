import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';
import { connect } from './db.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { extractionService } from './ai.js';

test('real accounts: book, confirm, complete, review is saved in MongoDB; rate and rating filters work', async t => {
  const mongo=process.env.MONGODB_TEST_URI?null:await MongoMemoryReplSet.create({binary:{version:'7.0.24'},replSet:{count:1,args:['--nounixsocket','--setParameter','diagnosticDataCollectionEnabled=false']}});
  let store,server;
  t.after(async()=>{
    if (server) await new Promise(resolve=>server.close(resolve));
    try {if (store) await store.db.dropDatabase();}
    finally {await store?.client.close();await mongo?.stop();}
  });
  store=await connect({uri:process.env.MONGODB_TEST_URI||mongo.getUri(),name:'roshan_test_life_'+Date.now()});
  server=createApp({store,now:()=>new Date('2026-11-10T10:00:00Z'),extract:extractionService({apiKey:''})}).listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/api';
  async function api(path,{method='GET',token,data,status=200}={}) {
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token&&{Authorization:'Bearer '+token})},body:data===undefined?undefined:JSON.stringify(data)});
    const body=await r.json();
    assert.equal(r.status,status,path+' '+JSON.stringify(body));
    return body;
  }
  const cust=await api('/auth/signup',{method:'POST',status:201,data:{name:'Real Customer',email:'c@example.com',password:'password-1',role:'customer'}});
  const work=await api('/auth/signup',{method:'POST',status:201,data:{name:'Real Worker',email:'w@example.com',password:'password-2',role:'worker'}});
  const C=cust.token, W=work.token;
  await api('/workers',{method:'POST',token:W,status:201,data:{name:'Real Worker',trade:'Plumber',experienceYears:3,city:'Islamabad',locality:'G-10',skills:['Taps'],price:900,accepting:true}});
  const job={trade:'Plumber',problem:'Leaking tap',urgency:'Soon',city:'Islamabad',locality:'G-10'};
  const req=await api('/service-requests',{method:'POST',token:C,status:201,data:job});
  const terms={description:'Leaking tap',location:'G-10, Islamabad',price:900,startsAt:'2026-11-12T10:00:00Z',endsAt:'2026-11-12T11:00:00Z'};
  const booking=await api('/bookings',{method:'POST',token:C,status:201,data:{requestId:req.id,workerId:work.user.id,...terms}});
  const confirmed=await api('/bookings/'+booking.id,{method:'PATCH',token:W,data:{action:'confirm',version:1}});
  const done=await api('/bookings/'+booking.id,{method:'PATCH',token:C,data:{action:'complete',version:confirmed.version}});
  assert.equal(done.status,'COMPLETED');
  await api('/reviews',{method:'POST',token:C,status:201,data:{bookingId:booking.id,rating:5,feedback:'Very good'}});
  const row=await store.db.collection('bookings').findOne({_id:booking.id});
  assert.equal(row.review.rating,5);
  assert.equal(row.review.feedback,'Very good');
  const reviews=await api('/workers/'+work.user.id+'/reviews');
  assert.equal(reviews.length,1);
  assert.equal((await api('/workers/'+work.user.id)).rating,5);

  // ---- filters ----
  const ids=list=>list.map(w=>w.id);
  const slot='&startsAt=2026-11-20T10:00:00Z&endsAt=2026-11-20T11:00:00Z';
  const all=await api('/workers?available=false'+slot);
  assert.ok(all.length>5);
  const cheap=await api('/workers?available=false&maxPrice=1500'+slot);
  assert.ok(cheap.length&&cheap.every(w=>w.price!=null&&w.price<=1500));
  assert.ok(cheap.length<all.length);
  const band=await api('/workers?available=false&minPrice=1800&maxPrice=2000'+slot);
  assert.ok(band.every(w=>w.price>=1800&&w.price<=2000));
  const top=await api('/workers?available=false&minRating=5'+slot);
  assert.ok(top.length&&top.every(w=>w.rating===5));
  const low=await api('/workers?available=false&sort=priceLow'+slot);
  assert.deepEqual(low.map(w=>w.price),[...low.map(w=>w.price)].sort((a,b)=>a-b));
  const high=await api('/workers?available=false&sort=priceHigh'+slot);
  assert.deepEqual(high.map(w=>w.price),[...high.map(w=>w.price)].sort((a,b)=>b-a));
  const rated=await api('/workers?available=false&sort=rating'+slot);
  const ratings=rated.map(w=>w.rating??0);
  assert.deepEqual(ratings,[...ratings].sort((a,b)=>b-a));
  const combo=await api('/workers?available=false&minRating=4&maxPrice=1800&sort=priceLow'+slot);
  assert.ok(combo.every(w=>w.rating>=4&&w.price<=1800));
  await api('/workers?sort=bogus',{status:422});
  assert.ok(ids(all).includes(work.user.id));
});
