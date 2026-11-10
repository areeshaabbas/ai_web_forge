import { useState } from 'react';
import { Check, ClipboardList, Plus, X } from 'lucide-react';
import { Field, pk, Speak } from './ui';

const labels={PENDING:'Awaiting approval',APPROVED:'Approved',DECLINED:'Declined',WITHDRAWN:'Withdrawn'};
export default function ExtraWork({booking,role,busy,onPropose,onDecide}) {
  const [editing,setEditing]=useState(false);
  const [description,setDescription]=useState('');
  const [amount,setAmount]=useState('');
  const pending=booking.addons.find(item=>item.status==='PENDING');
  const confirmed=booking.status==='CONFIRMED';
  return <section className="panel extra-work" aria-labelledby="extra-work-title">
    <div className="eyebrow"><ClipboardList size={16}/> AFTER BOOKING</div>
    <h2 id="extra-work-title">Pehle Poochho</h2>
    <p>Get approval before doing extra work.</p>
    <Speak text="پہلے پوچھو۔ کام کے دوران اگر کوئی اضافی کام یا چیز درکار ہو تو پہلے گاہک سے منظوری لیں۔ وجہ اور رقم لکھ کر بھیجیں۔ گاہک منظور کرے تو کل رقم بڑھ جائے گی۔"/>
    <dl className="extra-totals">
      <div><dt>Original agreed price</dt><dd>{pk(booking.price)}</dd></div>
      {booking.addons.map(item=><div key={item.id} className="extra-line">
        <dt><span>{item.description}</span><small className={'extra-status '+item.status.toLowerCase()}>{labels[item.status]}</small></dt>
        <dd>{item.status==='APPROVED'||item.status==='PENDING'?'+ ':''}{pk(item.amount)}</dd>
      </div>)}
      <div className="extra-grand"><dt>Current agreed total</dt><dd>{pk(booking.agreedTotal)}</dd></div>
      {pending&&<div className="extra-if"><dt>Total if approved</dt><dd>{pk(booking.agreedTotal+pending.amount)}</dd></div>}
    </dl>
    {confirmed&&pending&&(role==='customer'?<div className="actions">
      <button className="btn primary" disabled={busy} onClick={()=>onDecide(pending.id,'APPROVED')}><Check size={17}/> Approve extra</button>
      <button className="btn outline" disabled={busy} onClick={()=>onDecide(pending.id,'DECLINED')}><X size={17}/> Decline extra</button>
    </div>:<p className="callout" role="status">Waiting for the customer. The agreed price stays the same until they approve.</p>)}
    {confirmed&&!pending&&role==='worker'&&(editing?<form className="extra-form" onSubmit={async event=>{
      event.preventDefault();
      if(!description.trim()) return;
      if(await onPropose({description,amount:Number(amount)})) {
        setEditing(false);setDescription('');setAmount('');
      }
    }}>
      <Field label="Why is extra work needed?"><input required maxLength={250} value={description} onChange={event=>setDescription(event.target.value)} placeholder="e.g. Replace worn fan capacitor"/></Field>
      <Field label="Extra amount in PKR"><input required type="number" min="1" max="1000000" value={amount} onChange={event=>setAmount(event.target.value)}/></Field>
      <div className="actions"><button className="btn primary" disabled={busy||!description.trim()}>Send for approval</button><button type="button" className="btn quiet" disabled={busy} onClick={()=>setEditing(false)}>Close</button></div>
    </form>:<button className="btn primary extra-start" disabled={busy} onClick={()=>setEditing(true)}><Plus size={17}/> Request extra work</button>)}
  </section>;
}
