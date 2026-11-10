import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const dbPath = process.env.DB_PATH || fileURLToPath(new URL('./data/roshan.sqlite', import.meta.url));
export function connect(path = dbPath) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  return db;
}
export function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function seed(db) {
  transaction(db, () => {
    if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) return;
    const user = db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)');
    user.run(1, 'Ayesha Khan', 'customer');
    user.run(2, 'New demo worker', 'worker');
    const fixtures = [
      [3,'Bilal Ahmed','Electrician',12,'Rawalpindi','Satellite Town',1500,1,['Wiring','Fan Repair','Switchboard Repair'],5],
      [4,'Asad Mahmood','Plumber',9,'Islamabad','G-10',1800,1,['Pipe Leakage','Drain Cleaning'],5],
      [5,'Nadeem Akhtar','AC Technician',14,'Rawalpindi','Bahria Phase 8',2500,1,['AC Servicing','Cooling Repair'],4],
      [6,'Imran Ali','Carpenter',7,'Islamabad','G-11',2000,1,['Door Repair','Furniture Repair'],4],
      [7,'Sajid Hussain','Mechanic',16,'Rawalpindi','Saddar',1800,0,['Engine Service','Battery Check'],5],
      [8,'Farhan Iqbal','Painter',6,'Islamabad','I-8',2200,1,['Wall Painting','Paint Touchups'],4],
      [9,'Hamza Raza','Electrician',8,'Islamabad','G-10',1800,0,['Wiring','Lighting'],4],
      [10,'Adnan Qureshi','Plumber',11,'Rawalpindi','Satellite Town',1400,1,['Pipe Leakage','Tap Repair'],5],
    ];
    for (const [id,name,trade,years,city,locality,price,available,skills,stars] of fixtures) {
      user.run(id,name,'worker');
      db.prepare('INSERT INTO workers(id,trade,experienceYears,city,locality,price,seeded) VALUES(?,?,?,?,?,?,1)').run(id,trade,years,city,locality,price);
      db.prepare('INSERT INTO availability(workerId,accepting) VALUES(?,?)').run(id,available);
      for (const skill of skills) db.prepare('INSERT INTO skills VALUES(?,?)').run(id,skill);
      const job = db.prepare('INSERT INTO service_requests(customerId,trade,problem,urgency,city,locality,seeded) VALUES(1,?,?,?,?,?,1)').run(trade,skills[0],'Flexible',city,locality);
      const booking = db.prepare("INSERT INTO bookings(requestId,workerId,description,price,startsAt,endsAt,location,status,proposedBy,seeded) VALUES(?,?,?,?,?,?,?,'COMPLETED','customer',1)").run(job.lastInsertRowid,id,skills[0],price,'2026-01-12T08:00:00.000Z','2026-01-12T09:00:00.000Z',locality);
      db.prepare('INSERT INTO reviews(bookingId,rating,feedback) VALUES(?,?,?)').run(booking.lastInsertRowid,stars,'Arrived on time and explained the work clearly.');
    }
  });
}
