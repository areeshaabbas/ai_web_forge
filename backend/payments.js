import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { nextId, transaction } from './db.js';
import { cleanText, requireThat as check } from './domain.js';

export const methods = ['card', 'easypaisa', 'jazzcash', 'cash'];

const digits = value => String(value).replace(/[\s-]/g, '');
function luhn(number) {
  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    let d = Number(number[number.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
export function cardBrand(number) {
  if (/^4/.test(number)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))/.test(number)) return 'Mastercard';
  if (/^(9792|6[0-9]{3})/.test(number)) return 'PayPak/Other';
  return 'Card';
}

const cardSchema = z.object({
  holder: cleanText(70, 2),
  number: z.string().transform(digits).pipe(z.string().regex(/^\d{13,19}$/, 'Enter a valid card number.')).refine(luhn, 'That card number is not valid.'),
  expiry: z.string().trim().regex(/^(0[1-9]|1[0-2])\s*\/\s*\d{2}$/, 'Use expiry format MM/YY.'),
  cvv: z.string().trim().regex(/^\d{3,4}$/, 'CVV must be 3 or 4 digits.')
});
const walletSchema = z.object({
  number: z.string().transform(digits).pipe(z.string().regex(/^(\+92|0)?3\d{9}$/, 'Enter the mobile account number, like 03XXXXXXXXX.'))
});
export const paymentBody = z.discriminatedUnion('method', [
  z.object({ method: z.literal('card'), card: cardSchema }),
  z.object({ method: z.enum(['easypaisa', 'jazzcash']), wallet: walletSchema }),
  z.object({ method: z.literal('cash') })
]);

const publicId = ({ _id, ...rest }) => ({ id: _id, ...rest });

export function paymentService(store, market, now = () => new Date()) {
  const { db } = store;
  const payments = db.collection('payments');
  const bookings = db.collection('bookings');

  async function summary(bookingId, total, session) {
    const rows = await payments.find({ bookingId }, { session }).sort({ _id: 1 }).toArray();
    const paid = rows.filter(row => row.status === 'PAID').reduce((sum, row) => sum + row.amount, 0);
    const cash = rows.filter(row => row.status === 'PAY_ON_COMPLETION').reduce((sum, row) => sum + row.amount, 0);
    return { total, paid, cashPending: cash, due: Math.max(0, total - paid - cash), payments: rows.map(publicId) };
  }

  async function list(bookingId, actor) {
    const booking = await market.getBooking(bookingId, actor); // checks the actor belongs to this booking
    return summary(bookingId, booking.agreedTotal);
  }

  async function pay(bookingId, actor, input) {
    return transaction(store, async session => {
      const booking = await market.getBooking(bookingId, actor, session);
      check(actor.role === 'customer', 403, 'Only the customer can pay for a booking.');
      check(['CONFIRMED', 'COMPLETED'].includes(booking.status), 409, 'Payment opens once the booking is confirmed.');
      check(!booking.addons.some(item => item.status === 'PENDING'), 409, 'Approve or decline the pending extra work first so the total is final.');
      // Touch the booking inside the transaction so two simultaneous payments conflict and one retries on fresh totals.
      await bookings.updateOne({ _id: bookingId }, { $inc: { paymentRevision: 1 } }, { session });
      const before = await summary(bookingId, booking.agreedTotal, session);
      check(before.due > 0, 409, 'This booking is already fully paid or covered.');
      const row = {
        _id: await nextId(db, 'payments', session), bookingId, customerId: actor.id, workerId: booking.workerId,
        method: input.method, amount: before.due, currency: 'PKR', createdAt: now().toISOString(),
        reference: 'RR-' + randomBytes(4).toString('hex').toUpperCase(),
        // Simulated gateway: no real money moves. Replace this block with a call to a real PSP (Safepay, PayFast, JazzCash, Easypaisa).
        simulated: true
      };
      if (input.method === 'card') {
        const [mm, yy] = input.card.expiry.split('/').map(part => Number(part.trim()));
        const expires = new Date(Date.UTC(2000 + yy, mm, 1)); // first instant after the expiry month
        check(expires > now(), 422, 'This card has expired.');
        // Only non-sensitive fields are stored. The full card number and CVV are never written to the database.
        Object.assign(row, { status: 'PAID', card: { brand: cardBrand(input.card.number), last4: input.card.number.slice(-4), holder: input.card.holder, expiry: input.card.expiry.replace(/\s/g, '') } });
      } else if (input.method === 'cash') {
        row.status = 'PAY_ON_COMPLETION';
      } else {
        const n = input.wallet.number.replace(/^\+92/, '0');
        Object.assign(row, { status: 'PAID', wallet: { provider: input.method, maskedNumber: n.slice(0, 4) + '*****' + n.slice(-2) } });
      }
      await payments.insertOne(row, { session });
      return { payment: publicId(row), ...(await summary(bookingId, booking.agreedTotal, session)) };
    });
  }

  return { list, pay };
}
