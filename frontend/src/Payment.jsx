import { useEffect, useState } from 'react';
import { Banknote, Check, CreditCard, Lock, Smartphone, Wallet } from 'lucide-react';
import { ErrorNote, Field, pk, prettyTime, useTask } from './ui';

const methods=[
  {id:'card',label:'Card',icon:CreditCard},
  {id:'easypaisa',label:'Easypaisa',icon:Smartphone},
  {id:'jazzcash',label:'JazzCash',icon:Smartphone},
  {id:'cash',label:'Cash',icon:Banknote}
];
const methodName={card:'Card',easypaisa:'Easypaisa',jazzcash:'JazzCash',cash:'Cash on completion'};
const statusLabel={PAID:'Paid',PAY_ON_COMPLETION:'Pay in cash'};

const groupCard=value=>value.replace(/\D/g,'').slice(0,19).replace(/(.{4})/g,'$1 ').trim();
const formatExpiry=value=>{
  const d=value.replace(/\D/g,'').slice(0,4);
  return d.length>2?d.slice(0,2)+'/'+d.slice(2):d;
};
const detectBrand=number=>{
  const n=number.replace(/\s/g,'');
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  return '';
};
const emptyCard={holder:'',number:'',expiry:'',cvv:''};

export default function PaymentPanel({booking,role,api,pendingExtra}) {
  const path='/bookings/'+booking.id+'/payments';
  const [info,setInfo]=useState(null);
  const [method,setMethod]=useState('card');
  const [card,setCard]=useState(emptyCard);
  const [wallet,setWallet]=useState('');
  const [receipt,setReceipt]=useState(null);
  const load=useTask();
  const pay=useTask();
  // Reload when the agreed total changes (approved extra work bumps the booking version).
  useEffect(()=>{load.run(async()=>setInfo(await api(path)));},[api,path,booking.version]);
  const isCustomer=role==='customer';
  const due=info?.due??0;
  const brand=detectBrand(card.number);
  const setC=(key,value)=>setCard(c=>({...c,[key]:value}));

  function submit(event) {
    event.preventDefault();
    setReceipt(null);
    pay.run(async()=>{
      const body=method==='card'?{method,card:{...card,number:card.number.replace(/\s/g,'')}}
        :method==='cash'?{method}:{method,wallet:{number:wallet.replace(/[\s-]/g,'')}};
      const result=await api(path,'POST',body);
      // Wipe the sensitive fields from component state as soon as the server has accepted them.
      setCard(emptyCard);setWallet('');
      setInfo(result);setReceipt(result.payment);
    });
  }

  return <section className="panel payment" aria-labelledby="payment-title">
    <div className="eyebrow"><Wallet size={16}/> 06 / ADAIGI</div>
    <h2 id="payment-title">Payment</h2>
    <dl className="pay-summary">
      <div><dt>Agreed total</dt><dd>{pk(info?.total??booking.agreedTotal)}</dd></div>
      <div><dt>Paid</dt><dd>{pk(info?.paid??0)}</dd></div>
      {Boolean(info?.cashPending)&&<div><dt>To pay in cash</dt><dd>{pk(info.cashPending)}</dd></div>}
      <div className="due"><dt>Balance due</dt><dd>{pk(due)}</dd></div>
    </dl>
    <ErrorNote error={load.error}/>

    {receipt&&<div className="callout receipt" role="status"><Check size={16}/><span>
      {receipt.status==='PAID'?'Payment recorded':'Cash payment noted'} · {pk(receipt.amount)} · Ref <strong>{receipt.reference}</strong></span></div>}

    {isCustomer&&info&&due>0&&(pendingExtra
      ?<p className="callout">Decide on the pending extra work first, so the amount to pay is final.</p>
      :<form onSubmit={submit} className="pay-form" autoComplete="on">
        <div role="radiogroup" aria-label="Payment method" className="method-tabs">
          {methods.map(({id,label,icon:Icon})=><button type="button" role="radio" aria-checked={method===id} className={'tile '+(method===id?'selected':'')} key={id} onClick={()=>{setMethod(id);pay.setError('');}}><Icon size={18}/><span>{label}</span></button>)}
        </div>

        {method==='card'&&<>
          <Field label="Name on card"><input required minLength={2} maxLength={70} autoComplete="cc-name" value={card.holder} onChange={e=>setC('holder',e.target.value)}/></Field>
          <Field label="Card number"><span className="password-wrap">
            <input required inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" maxLength={23} pattern="[0-9 ]{13,23}" value={card.number} onChange={e=>setC('number',groupCard(e.target.value))}/>
            {brand&&<span className="card-brand">{brand}</span>}
          </span></Field>
          <div className="fields">
            <Field label="Expiry (MM/YY)"><input required inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" maxLength={5} pattern="(0[1-9]|1[0-2])/[0-9]{2}" value={card.expiry} onChange={e=>setC('expiry',formatExpiry(e.target.value))}/></Field>
            <Field label="CVV"><input required type="password" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" maxLength={4} pattern="[0-9]{3,4}" value={card.cvv} onChange={e=>setC('cvv',e.target.value.replace(/\D/g,'').slice(0,4))}/></Field>
          </div>
        </>}

        {(method==='easypaisa'||method==='jazzcash')&&<Field label={methodName[method]+' mobile account number'}>
          <input required type="tel" inputMode="tel" placeholder="03XXXXXXXXX" pattern="(\+92|0)?3[0-9 \-]{9,13}" value={wallet} onChange={e=>setWallet(e.target.value)}/></Field>}

        {method==='cash'&&<p className="subtle">Pay {pk(due)} to the worker in cash when the job is finished. We’ll note it on the booking.</p>}

        <ErrorNote plain error={pay.error}/>
        <button className="btn primary wide" disabled={pay.pending}><Lock size={16}/> {pay.pending?'Processing…':method==='cash'?'Confirm cash payment':'Pay '+pk(due)}</button>
        <small className="pay-note">Demo payment: no real money is charged. We never save your full card number or CVV — only the card type and last 4 digits.</small>
      </form>)}

    {isCustomer&&info&&due===0&&<p className="callout"><Check size={16}/> Nothing left to pay for this booking.</p>}
    {!isCustomer&&info&&<p className="subtle">{due>0?'Waiting for the customer to pay '+pk(due)+'.':'Payment is complete for this booking.'}</p>}

    {Boolean(info?.payments.length)&&<><h3>Payment history</h3>
      <ul className="pay-history">{info.payments.map(p=><li key={p.id}>
        <div><strong>{methodName[p.method]}{p.card?' · '+p.card.brand+' •••• '+p.card.last4:''}{p.wallet?' · '+p.wallet.maskedNumber:''}</strong>
          <small>{prettyTime(p.createdAt)} · Ref {p.reference}</small></div>
        <span><b>{pk(p.amount)}</b><span className={"pill "+(p.status==="PAID"?"good":"neutral")}>{statusLabel[p.status]??p.status}</span></span>
      </li>)}</ul></>}
  </section>;
}
