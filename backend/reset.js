import { connect, seed, transaction } from './db.js';
const db = connect();
transaction(db, () => db.exec('DELETE FROM work_evidence; DELETE FROM reviews; DELETE FROM messages; DELETE FROM bookings; DELETE FROM service_requests; DELETE FROM skills; DELETE FROM availability; DELETE FROM workers; DELETE FROM users;'));
seed(db);
db.close();
console.log('Fictional demo dataset reset.');
