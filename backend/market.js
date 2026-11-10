import { transaction } from './db.js';
import { requireThat as check } from './domain.js';

const cardQuery = `SELECT w.*,u.name,a.accepting,
  (SELECT ROUND(AVG(r.rating),1) FROM reviews r JOIN bookings b ON b.id=r.bookingId WHERE b.workerId=w.id) rating,
  (SELECT COUNT(*) FROM reviews r JOIN bookings b ON b.id=r.bookingId WHERE b.workerId=w.id) reviewCount,
  (SELECT COUNT(*) FROM bookings b WHERE b.workerId=w.id AND b.status='COMPLETED') completedJobs,
  (SELECT json_group_array(name) FROM skills WHERE workerId=w.id) skillsJson
  FROM workers w JOIN users u ON u.id=w.id JOIN availability a ON a.workerId=w.id`;
const overlap = `SELECT startsAt,endsAt FROM bookings WHERE workerId=? AND status='CONFIRMED'
 AND startsAt < ? AND endsAt > ? AND id<>? ORDER BY startsAt`;
const bookingQuery = `SELECT b.*,s.customerId,s.trade,s.city,s.locality,u.name workerName,c.name customerName,
 EXISTS(SELECT 1 FROM reviews WHERE bookingId=b.id) reviewed,
 EXISTS(SELECT 1 FROM work_evidence WHERE bookingId=b.id) hasEvidence
 FROM bookings b JOIN service_requests s ON s.id=b.requestId JOIN users u ON u.id=b.workerId JOIN users c ON c.id=s.customerId`;
export function marketplace(db, now = () => new Date()) {
  const conflicts = db.prepare(overlap);
  const blocked = (id, startsAt, endsAt, skip = 0) => conflicts.all(id,endsAt,startsAt,skip);
  const card = (row, filters = {}) => {
    const instant = now();
    const start = filters.startsAt ?? instant.toISOString();
    const end = filters.endsAt ?? new Date(+instant + 1).toISOString();
    const available = Boolean(row.accepting && !blocked(row.id,start,end).length);
    const match = [];
    if (filters.trade) match.push(filters.trade);
    if (filters.locality) match.push('Same locality');
    else if (filters.city) match.push('Same city');
    if (available) match.push(filters.startsAt ? 'Free for your slot' : 'Free now');
    const {skillsJson, ...rest} = row;
    return {...rest, skills:JSON.parse(skillsJson), available, match};
  };
  function worker(id) {
    const row = db.prepare(cardQuery + ' WHERE w.id=?').get(id);
    check(row,404,'Worker profile not found.');
    return card(row);
  }
  function search(filters) {
    const conditions = [];
    const params = [];
    for (const field of ['trade','city','locality']) {
      if (!filters[field]) continue;
      conditions.push('w.' + field + ' = ? COLLATE NOCASE');
      params.push(filters[field]);
    }
    if (filters.minExperience) {
      conditions.push('w.experienceYears >= ?');
      params.push(filters.minExperience);
    }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    return db.prepare(cardQuery + where).all(...params).map(row => card(row,filters))
      .filter(row => (!filters.available || row.available) && (!filters.minRating || row.rating >= filters.minRating))
      .sort((a,b) => Number(b.available)-Number(a.available) || (b.rating ?? 0)-(a.rating ?? 0) || b.experienceYears-a.experienceYears || a.id-b.id);
  }
  function saveWorker(id, data, create) {
    transaction(db, () => {
      const exists = db.prepare('SELECT id FROM workers WHERE id=?').get(id);
      check(create ? !exists : exists,create ? 409 : 404,create ? 'This profile already exists. Edit it from Worker hub.' : 'Worker profile not found.');
      db.prepare('UPDATE users SET name=? WHERE id=?').run(data.name,id);
      db.prepare(`INSERT INTO workers(id,trade,experienceYears,city,locality,price) VALUES(?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET trade=excluded.trade, experienceYears=excluded.experienceYears, city=excluded.city, locality=excluded.locality, price=excluded.price`)
        .run(id,data.trade,data.experienceYears,data.city,data.locality,data.price);
      db.prepare('INSERT INTO availability VALUES(?,?) ON CONFLICT(workerId) DO UPDATE SET accepting=excluded.accepting').run(id,Number(data.accepting));
      db.prepare('DELETE FROM skills WHERE workerId=?').run(id);
      const add = db.prepare('INSERT OR IGNORE INTO skills VALUES(?,?)');
      data.skills.forEach(skill => add.run(id,skill));
    });
    return worker(id);
  }
  function reviews(id) {
    worker(id);
    return db.prepare(`SELECT r.*,u.name customerName,b.seeded,EXISTS(SELECT 1 FROM work_evidence WHERE bookingId=b.id) hasEvidence
      FROM reviews r JOIN bookings b ON b.id=r.bookingId JOIN service_requests s ON s.id=b.requestId
      JOIN users u ON u.id=s.customerId WHERE b.workerId=? ORDER BY r.createdAt DESC,b.id DESC`).all(id);
  }
  function getBooking(id, actor) {
    const row = db.prepare(bookingQuery+' WHERE b.id=?').get(id);
    check(row && (actor.role==='worker' ? row.workerId===actor.id : row.customerId===actor.id),404,'Booking not found for this demo role.');
    return row;
  }
  function listBookings(actor) {
    const owner = actor.role==='worker' ? 'b.workerId' : 's.customerId';
    return db.prepare(bookingQuery+' WHERE '+owner+'=? ORDER BY b.id DESC').all(actor.id);
  }
  function free(workerId, data, id) {
    const w = worker(workerId);
    check(w.accepting,409,'This worker has paused new jobs.');
    check(!blocked(workerId,data.startsAt,data.endsAt,id).length,409,'That time overlaps a confirmed booking. Propose another slot.');
  }
  function createBooking(actor, data) {
    return transaction(db, () => {
      const job = db.prepare('SELECT * FROM service_requests WHERE id=? AND customerId=?').get(data.requestId,actor.id);
      check(job,404,'Service request not found.');
      check(data.startsAt >= now().toISOString(),422,'Choose a future start time.');
      const w = worker(data.workerId);
      check(w.trade===job.trade && w.city===job.city,422,'Choose a worker who matches the trade and city.');
      free(data.workerId,data);
      check(!db.prepare("SELECT 1 FROM bookings WHERE requestId=? AND status NOT IN ('CANCELLED','REJECTED')").get(job.id),409,'This service request already has a booking.');
      const row = db.prepare(`INSERT INTO bookings(requestId,workerId,description,price,startsAt,endsAt,location,status,proposedBy)
        VALUES(?,?,?,?,?,?,?,'REQUESTED','customer')`).run(data.requestId,data.workerId,data.description,data.price,data.startsAt,data.endsAt,data.location);
      return getBooking(Number(row.lastInsertRowid),actor);
    });
  }
  function updateBooking(id, actor, input) {
    return transaction(db, () => {
      const row = getBooking(id,actor);
      check(row.version===input.version,409,'The agreement changed. Refresh to see the latest terms.');
      const open = ['REQUESTED','NEGOTIATING'].includes(row.status);
      const timestamp = now().toISOString();
      let status;
      let data = row;
      let proposedBy = row.proposedBy;
      switch (input.action) {
        case 'propose':
          check(open,409,'This agreement is closed to new proposals.');
          data = input.terms;
          check(data.startsAt >= timestamp,422,'Choose a future start time.');
          proposedBy = actor.role;
          status = 'NEGOTIATING';
          break;
        case 'confirm':
          check(open && actor.role!==row.proposedBy,409,'The other party must accept the latest terms.');
          check(row.startsAt >= timestamp,409,'The proposed start time passed. Propose another time.');
          free(row.workerId,row,id);
          status = 'CONFIRMED';
          break;
        case 'complete':
          check(actor.role==='customer' && row.status==='CONFIRMED',409,'Only the customer can confirm completion of a booked job.');
          status = 'COMPLETED';
          break;
        case 'reject':
          check(actor.role==='worker' && open,409,'Only the worker can decline an open request.');
          status = 'REJECTED';
          break;
        case 'cancel':
          check(open || row.status==='CONFIRMED',409,'This booking is already closed.');
          status = 'CANCELLED';
          break;
      }
      db.prepare('UPDATE bookings SET description=?,price=?,startsAt=?,endsAt=?,location=?,status=?,proposedBy=?,version=version+1 WHERE id=?')
        .run(data.description,data.price,data.startsAt,data.endsAt,data.location,status,proposedBy,id);
      return getBooking(id,actor);
    });
  }
  return {worker,search,saveWorker,reviews,getBooking,listBookings,createBooking,updateBooking,blocked};
}
