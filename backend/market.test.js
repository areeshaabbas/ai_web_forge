import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';
import { connect } from './db.js';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { extractionService } from './ai.js';

test('both roles share a persisted lifecycle with slot and review safeguards', async t => {
  const mongo=process.env.MONGODB_TEST_URI?null:await MongoMemoryReplSet.create({binary:{version:'7.0.24'},replSet:{count:1,args:['--nounixsocket','--setParameter','diagnosticDataCollectionEnabled=false']}});
  let store,server;
  t.after(async()=>{
    if (server) await new Promise(resolve=>server.close(resolve));
    try {if (store) await store.db.dropDatabase();}
    finally {await store?.client.close();await mongo?.stop();}
  });
  store=await connect({uri:process.env.MONGODB_TEST_URI||mongo.getUri(),name:'roshan_test_'+Date.now()});
  const clock=()=>new Date('2026-11-10T10:00:00Z');
  server=createApp({store,now:clock,extract:extractionService({apiKey:''})}).listen(0,'127.0.0.1');
  await once(server,'listening');
  async function api(path,{method='GET',user=1,data,status=200}={}) {
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/api'+path,{method,headers:{'x-demo-user':String(user),'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
    const body=await response.json();
    assert.equal(response.status,status,JSON.stringify(body));
    return body;
  }
  const extraction=await api('/ai/worker-profile',{method:'POST',user:2,data:{text:'Mera naam Usman Ali hai. Main 12 saal se electrician ka kaam kar raha hoon. Main Satellite Town, Rawalpindi mein wiring, fan repair aur switch board ka kaam karta hoon.'}});
  assert.deepEqual(extraction.data,{name:'Usman Ali',trade:'Electrician',experienceYears:12,city:'Rawalpindi',locality:'Satellite Town',skills:['Wiring','Fan Repair','Switchboard Repair']});
  assert.equal(extraction.source,'fallback');
  await api('/workers',{method:'POST',user:2,status:201,data:{...extraction.data,price:1200,accepting:true}});
  const understood=await api('/ai/understand-job',{method:'POST',data:{text:'میرے کچن میں پائپ لیک ہو رہا ہے، آج پلمبر چاہیے۔'}});
  assert.equal(understood.data.trade,'Plumber');
  assert.equal(understood.data.urgency,'Today');
  assert.equal(understood.data.city,null);
  const job={trade:'Electrician',problem:'Fan repair',urgency:'Today',city:'Rawalpindi',locality:'Satellite Town'};
  const req=await api('/service-requests',{method:'POST',data:job,status:201});
  const nextReq=await api('/service-requests',{method:'POST',data:job,status:201});
  const slot={startsAt:'2026-11-10T10:00:00Z',endsAt:'2026-11-10T11:00:00Z'};
  const search='/workers?'+new URLSearchParams({...slot,city:job.city,locality:job.locality,trade:job.trade,available:'true'});
  assert.ok((await api(search)).some(w=>w.id===2));
  const terms={description:'Fan repair',location:'Satellite Town, Rawalpindi',price:1200,...slot};
  const create=(requestId)=>api('/bookings',{method:'POST',status:201,data:{requestId,workerId:2,...terms}});
  const first=await create(req.id);
  const second=await create(nextReq.id);
  assert.equal((await api('/bookings',{user:2})).length,2);
  const url='/bookings/'+first.id;
  await api(url,{user:3,status:404});
  await api(url+'/messages',{method:'POST',user:2,status:201,data:{preset:0}});
  assert.equal((await api(url+'/messages'))[0].body,'Main available hoon.');
  await api(url,{method:'PATCH',status:409,data:{action:'confirm',version:1}});
  await api(url,{method:'PATCH',user:2,data:{action:'propose',version:1,terms:{...terms,price:1500}}});
  await api(url,{method:'PATCH',status:409,data:{action:'confirm',version:1}});
  const confirmed=await api(url,{method:'PATCH',data:{action:'confirm',version:2}});
  assert.equal(confirmed.status,'CONFIRMED');
  assert.equal(confirmed.price,1500);
  assert.equal((await api('/workers/2/availability')).occupied.length,1);
  assert.ok(!(await api(search)).some(w=>w.id===2));
  await api('/bookings/'+second.id,{method:'PATCH',user:2,status:409,data:{action:'confirm',version:1}});
  const addonUrl=url+'/addons';
  const requestAddon=(amount)=>api(addonUrl,{method:'POST',user:2,status:201,data:{description:'Replace capacitor',amount}});
  const pending=await requestAddon(450);
  assert.equal(pending.agreedTotal,1500);
  await api(url,{method:'PATCH',status:409,data:{action:'complete',version:pending.version}});
  const decide=(id,status,expected=200)=>api(addonUrl+'/'+id,{method:'PATCH',status:expected,data:{status}});
  const declined=await decide(pending.addons[0].id,'DECLINED');
  assert.equal(declined.agreedTotal,1500);
  await decide(pending.addons[0].id,'APPROVED',409);
  const replacement=await requestAddon(350);
  const approved=await decide(replacement.addons.at(-1).id,'APPROVED');
  assert.equal(approved.price,1500);
  assert.equal(approved.agreedTotal,1850);
  assert.equal((await api(url,{user:2})).agreedTotal,1850);
  const review={bookingId:first.id,rating:4,feedback:'Great work.'};
  await api('/reviews',{method:'POST',status:409,data:review});
  const photo={mime:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII='};
  await api(url+'/evidence',{method:'PUT',user:2,status:201,data:photo});
  await api(url+'/evidence',{user:3,status:404});
  const evidence=await fetch('http://127.0.0.1:'+server.address().port+'/api'+url+'/evidence',{headers:{'x-demo-user':'2'}});
  assert.equal(evidence.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await evidence.arrayBuffer()),Buffer.from(photo.base64,'base64'));
  await api(url,{method:'PATCH',user:2,status:409,data:{action:'complete',version:approved.version}});
  await api(url,{method:'PATCH',data:{action:'complete',version:approved.version}});
  await api('/reviews',{method:'POST',status:201,data:review});
  await api('/reviews',{method:'POST',status:409,data:review});
  const worker=await api('/workers/2');
  assert.equal(worker.rating,4);
  assert.equal(worker.completedJobs,1);
  assert.ok((await api(search)).some(w=>w.id===2));
  assert.equal((await api('/workers/2/reviews'))[0].hasEvidence,1);
  const thirdReq=await api('/service-requests',{method:'POST',data:job,status:201});
  const third=await create(thirdReq.id);
  const competing=await Promise.all([second.id,third.id].map(bookingId=>fetch('http://127.0.0.1:'+server.address().port+'/api/bookings/'+bookingId,{
    method:'PATCH',headers:{'x-demo-user':'2','Content-Type':'application/json'},body:JSON.stringify({action:'confirm',version:1})
  })));
  assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
  for (const result of competing) await result.json();
  await api('/workers/2/availability',{method:'PATCH',user:2,data:{accepting:false}});
  assert.ok(!(await api(search)).some(w=>w.id===2));
});
