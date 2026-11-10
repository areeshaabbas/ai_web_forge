import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {MongoMemoryReplSet} from 'mongodb-memory-server-core';
import {connect} from './db.js';
import {createApp} from './app.js';
import {extractionService} from './ai.js';

test('default security: forged demo headers, profile ownership, session expiry, AI limits',async t=>{
  const mongo=await MongoMemoryReplSet.create({binary:{version:'7.0.24'},replSet:{count:1,args:['--nounixsocket','--setParameter','diagnosticDataCollectionEnabled=false']}});
  const store=await connect({uri:mongo.getUri(),name:'security'});
  let clock=new Date('2026-11-10T10:00:00Z');
  const server=createApp({store,now:()=>clock,extract:extractionService({apiKey:''})}).listen(0,'127.0.0.1');
  t.after(async()=>{await new Promise(r=>server.close(r));await store.client.close();await mongo.stop();});
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/api';
  async function api(path,{method='GET',data,token,headers={},status=200}={}){
    const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:data===undefined?undefined:JSON.stringify(data)});
    const result=await res.json();assert.equal(res.status,status,JSON.stringify(result));return result;
  }
  assert.deepEqual(await api('/demo-users'),[]);
  await api('/workers/3',{method:'PATCH',headers:{'x-demo-user':'3'},data:{name:'Intruder'},status:401});
  const signup=async(role,email)=>api('/auth/signup',{method:'POST',status:201,data:{name:'Test User',role,email,password:'StrongPass-123'}});
  const a=await signup('worker','a@example.com'),b=await signup('worker','b@example.com'),c=await signup('customer','c@example.com');
  const profile={name:'Private Worker',trade:'Plumber',experienceYears:5,city:'Islamabad',locality:'G-10',skills:['Pipe Leakage'],price:1500,accepting:true};
  await api('/workers',{method:'POST',token:a.token,data:profile,status:201});
  await api('/workers/'+a.user.id,{method:'PATCH',token:b.token,data:{name:'Intruder'},status:403});
  await api('/workers/'+a.user.id+'/availability',{method:'PATCH',token:c.token,data:{accepting:false},status:403});
  await api('/workers/'+a.user.id,{method:'PATCH',token:a.token,data:{name:'Updated Name',role:'customer',email:'injected@example.com'}});
  assert.equal((await api('/auth/me',{token:a.token})).role,'worker');
  assert.equal((await api('/auth/me',{token:a.token})).email,'a@example.com');
  await api('/auth/me',{token:a.token+'.extra',status:401});
  await api('/workers/3',{method:'PATCH',token:'bad',headers:{'x-demo-user':'3'},data:{name:'Intruder'},status:401});
  const text='My kitchen pipe leaks in G-10 Islamabad today.';
  for(let i=0;i<10;i++){
    const result=await api('/ai/understand-job',{method:'POST',token:c.token,data:{text}});
    assert.equal(result.source,'fallback');assert.ok(result.analysis.checklist.length);
  }
  await api('/ai/understand-job',{method:'POST',token:c.token,data:{text},status:429});
  async function booked(){
    const req=await api('/service-requests',{method:'POST',token:c.token,status:201,data:{trade:'Plumber',problem:'Pipe leak',urgency:'Soon',city:'Islamabad',locality:'G-10'}});
    const b=await api('/bookings',{method:'POST',token:c.token,status:201,data:{requestId:req.id,workerId:a.user.id,description:'Fix pipe',price:1500,location:'G-10',startsAt:'2026-11-12T10:00:00Z',endsAt:'2026-11-12T11:00:00Z'}});
    return api('/bookings/'+b.id,{method:'PATCH',token:a.token,data:{action:'confirm',version:b.version}});
  }
  const cashBooking=await booked();
  await api('/bookings/'+cashBooking.id+'/payments',{method:'POST',token:c.token,status:201,data:{method:'cash'}});
  await api('/bookings/'+cashBooking.id,{method:'PATCH',token:c.token,data:{action:'cancel',version:cashBooking.version}});
  assert.equal((await api('/bookings/'+cashBooking.id+'/payments',{token:c.token})).cashPending,0);
  const paidBooking=await booked();
  await api('/bookings/'+paidBooking.id+'/payments',{method:'POST',token:c.token,status:201,data:{method:'jazzcash',wallet:{number:'03001234567'}}});
  await api('/bookings/'+paidBooking.id,{method:'PATCH',token:c.token,status:409,data:{action:'cancel',version:paidBooking.version}});
  clock=new Date('2026-11-25T10:00:00Z');
  await api('/auth/me',{token:a.token,status:401});
});

test('local extraction does not invent missing details and supplies a reviewable work checklist',async()=>{
  const extract=extractionService({apiKey:''});
  const result=await extract('job','Kitchen pipe leakage');
  assert.equal(result.data.trade,'Plumber');assert.equal(result.data.city,null);assert.equal(result.data.urgency,null);
  assert.ok(result.analysis.requiredSkills.includes('Pipe Leakage'));
  assert.ok(result.analysis.questions.some(q=>q.includes('city')));
  const person=await extract('profile','My name is Ali. I am 25 years old, an electrician in Islamabad.');
  assert.equal(person.data.experienceYears,null);
});
