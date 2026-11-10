import { readFileSync } from 'node:fs';
import { transaction } from './db.js';

const profiles=[
  [3,'Bilal Ahmed','Electrician',12,'Rawalpindi','Satellite Town',1500,true,['Wiring','Fan Repair','Switchboard Repair'],5],
  [4,'Asad Mahmood','Plumber',9,'Islamabad','G-10',1800,true,['Pipe Leakage','Drain Cleaning'],5],
  [5,'Nadeem Akhtar','AC Technician',14,'Rawalpindi','Bahria Phase 8',2500,true,['AC Servicing','Cooling Repair'],4],
  [6,'Imran Ali','Carpenter',7,'Islamabad','G-11',2000,true,['Door Repair','Furniture Repair'],4],
  [7,'Sajid Hussain','Mechanic',16,'Rawalpindi','Saddar',1800,false,['Engine Service','Battery Check'],5],
  [8,'Farhan Iqbal','Painter',6,'Islamabad','I-8',2200,true,['Wall Painting','Paint Touchups'],4],
  [9,'Hamza Raza','Electrician',8,'Islamabad','G-10',1800,false,['Wiring','Lighting'],4],
  [10,'Adnan Qureshi','Plumber',11,'Rawalpindi','Satellite Town',1400,true,['Pipe Leakage','Tap Repair'],5],
  [11,'Mariam Noor','Electrician',5,'Rawalpindi','Chaklala',1300,true,['Lighting','Fan Repair'],5]
];
const historical='2026-01-12T08:00:00.000Z';
const historicalEnd='2026-01-12T09:00:00.000Z';
const sampleEvidence=readFileSync(new URL('./seed-work.png',import.meta.url));

export async function seed(store,{reset=false}={}) {
  const {db}=store;
  try {
    await transaction(store,async session=>{
      const options={session};
      const meta=db.collection('meta');
      if (reset) {
        for (const name of ['users','requests','bookings','messages','counters','meta']) {
          await db.collection(name).deleteMany({},options);
        }
      }
      if (await meta.findOne({_id:'demo-v1'},options)) return;
      await meta.insertOne({_id:'demo-v1'},options);
      const users=[{_id:1,name:'Ayesha Khan',role:'customer'},{_id:2,name:'New demo worker',role:'worker'},{_id:12,name:'Sara Malik',role:'customer'}];
      const requests=[];
      const bookings=[];
      const messages=[];
      for (const [id,name,trade,experienceYears,city,locality,price,accepting,skills,rating] of profiles) {
        users.push({_id:id,name,role:'worker',profile:{trade,experienceYears,city,locality,price,accepting,skills,seeded:1}});
        const n=bookings.length+1;
        const customerId=n%2?1:12;
        const customerName=n%2?'Ayesha Khan':'Sara Malik';
        requests.push({_id:n,customerId,trade,problem:skills[0],urgency:'Flexible',city,locality,seeded:1,createdAt:historical});
        bookings.push({_id:n,requestId:n,workerId:id,customerId,workerName:name,customerName,trade,city,locality,
          description:skills[0],price,startsAt:historical,endsAt:historicalEnd,location:locality,status:'COMPLETED',active:true,
          proposedBy:'customer',version:1,seeded:1,createdAt:historical,
          review:{rating,feedback:'Arrived on time and explained the work clearly.',createdAt:historicalEnd},
          addons:[],...(id===3?{evidence:{mime:'image/png',photo:sampleEvidence}}:{})});
        messages.push({_id:n,bookingId:n,senderId:id,senderName:name,body:'Kaam mukammal ho gaya.',createdAt:historicalEnd});
      }
      // A ready-to-demo change order, far enough ahead to avoid the default search window.
      const n=bookings.length+1;
      const startsAt=new Date(Date.now()+86400000).toISOString();
      const endsAt=new Date(Date.parse(startsAt)+3600000).toISOString();
      const createdAt=new Date().toISOString();
      requests.push({_id:n,customerId:1,trade:'Electrician',problem:'Ceiling fan repair',urgency:'Soon',city:'Rawalpindi',locality:'Satellite Town',seeded:1,createdAt});
      bookings.push({_id:n,requestId:n,workerId:3,customerId:1,workerName:'Bilal Ahmed',customerName:'Ayesha Khan',
        trade:'Electrician',city:'Rawalpindi',locality:'Satellite Town',description:'Ceiling fan repair',price:1500,startsAt,endsAt,
        location:'Satellite Town, Rawalpindi',status:'CONFIRMED',active:true,proposedBy:'customer',version:1,seeded:1,createdAt,
        addons:[{id:'seed-capacitor',description:'Replace worn fan capacitor',amount:450,status:'PENDING',createdAt}]});
      messages.push({_id:n,bookingId:n,senderId:3,senderName:'Bilal Ahmed',body:'Capacitor ki replacement ke liye extra approval bheja hai.',createdAt});
      await db.collection('users').insertMany(users,options);
      await db.collection('requests').insertMany(requests,options);
      await db.collection('bookings').insertMany(bookings,options);
      await db.collection('messages').insertMany(messages,options);
      await db.collection('counters').insertMany(['requests','bookings','messages'].map(name=>({_id:name,value:n})),options);
    });
  } catch (error) {
    if (error.code!==11000||reset||!await store.db.collection('meta').findOne({_id:'demo-v1'})) throw error;
  }
}
