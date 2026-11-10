import { z } from 'zod';
export const trades = ['Electrician','Plumber','Carpenter','AC Technician','Mechanic','Painter','Other'];
export const cities = ['Islamabad','Rawalpindi'];
export const urgencies = ['Today','Soon','Flexible'];
export const cleanText = (max, min = 1) => z.string().transform(value => value.normalize('NFC').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim()).pipe(z.string().min(min).max(max));
const skill = cleanText(60);
export const profile = z.object({
  name: cleanText(70), trade: z.enum(trades), experienceYears: z.number().int().min(0).max(80),
  city: z.enum(cities), locality: cleanText(90), skills: z.array(skill).min(1).max(12),
  price: z.number().int().min(100).max(1000000).nullable(), accepting: z.boolean()
});
export const request = z.object({trade: z.enum(trades), problem: cleanText(500), urgency: z.enum(urgencies), city: z.enum(cities), locality: cleanText(90)});
export const extractedProfile = z.object({
  name: cleanText(70).nullable(), trade: z.enum(trades).nullable(), experienceYears: z.number().int().min(0).max(80).nullable(),
  city: z.enum(cities).nullable(), locality: cleanText(90).nullable(), skills: z.array(skill).max(12)
});
export const extractedJob = z.object({
  trade: z.enum(trades).nullable(), problem: cleanText(500).nullable(), urgency: z.enum(urgencies).nullable(),
  city: z.enum(cities).nullable(), locality: cleanText(90).nullable()
});
export const slot = z.object({
  startsAt: z.iso.datetime({offset:true}).transform(v => new Date(v).toISOString()),
  endsAt: z.iso.datetime({offset:true}).transform(v => new Date(v).toISOString())
}).refine(v => v.endsAt > v.startsAt && Date.parse(v.endsAt) - Date.parse(v.startsAt) <= 86400000, {message:'Choose an end time within 24 hours of the start.'});
export const terms = z.object({
  description: cleanText(500), price: z.number().int().min(100).max(1000000), location: cleanText(250)
}).and(slot);
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requireThat(condition, status, message) {
  if (!condition) throw new HttpError(status, message);
}
