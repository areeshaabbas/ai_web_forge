import { MongoClient } from 'mongodb';
import { seed } from './seed.js';

export async function connect({
  uri=process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0',
  name=process.env.MONGODB_DB || 'roshan_rozgar'
}={}) {
  const client=new MongoClient(uri,{serverSelectionTimeoutMS:7000});
  try {
    await client.connect();
    const db=client.db(name);
    const hello=await db.command({hello:1});
    if (!hello.setName && hello.msg!=='isdbgrid') throw new Error('A MongoDB replica set or Atlas cluster is required.');
    const store={client,db};
    await Promise.all([
      db.collection('users').createIndex({role:1,'profile.trade':1,'profile.city':1}),
      db.collection('requests').createIndex({customerId:1,_id:-1}),
      db.collection('bookings').createIndex({workerId:1,status:1,startsAt:1,endsAt:1}),
      db.collection('bookings').createIndex({customerId:1,_id:-1}),
      db.collection('bookings').createIndex({requestId:1},{unique:true,partialFilterExpression:{active:true}}),
      db.collection('messages').createIndex({bookingId:1,_id:1}),
      db.collection('users').createIndex({email:1},{unique:true,partialFilterExpression:{email:{$exists:true}}}),
      db.collection('payments').createIndex({bookingId:1,_id:1}),
      db.collection('payments').createIndex({customerId:1,_id:-1})
    ]);
    await seed(store);
    return store;
  } catch (error) {
    await client.close();
    throw error;
  }
}

export function transaction(store, action) {
  return store.client.withSession(session=>session.withTransaction(()=>action(session),{
    readConcern:{level:'snapshot'},writeConcern:{w:'majority'}
  }));
}

export async function nextId(db,name,session) {
  const counter=await db.collection('counters').findOneAndUpdate({_id:name},{$inc:{value:1}},{upsert:true,returnDocument:'after',session});
  return counter.value;
}
