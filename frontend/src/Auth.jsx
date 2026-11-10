import { useRef, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Eye, EyeOff, LogIn, UserPlus, UserRound } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorNote, Field, Intro, useDemo, useTask } from './ui';

function PasswordField({label,value,onChange,autoComplete,hint}) {
  const [shown,setShown]=useState(false);
  return <Field label={label}>
    <span className="password-wrap">
      <input required type={shown?'text':'password'} minLength={autoComplete==='new-password'?8:undefined} maxLength={128} autoComplete={autoComplete} value={value} onChange={e=>onChange(e.target.value)}/>
      <button type="button" className="password-toggle" aria-label={shown?'Hide password':'Show password'} aria-pressed={shown} onClick={()=>setShown(v=>!v)}>{shown?<EyeOff size={18}/>:<Eye size={18}/>}</button>
    </span>
    {hint&&<small className="field-hint">{hint}</small>}
  </Field>;
}

export function SignIn() {
  const {api,onAuth,account}=useDemo();
  const navigate=useNavigate();
  const task=useTask();
  const [form,setForm]=useState({email:'',password:''});
  const set=(key,value)=>setForm(f=>({...f,[key]:value}));
  if (account) return <Navigate to="/dashboard" replace/>;
  return <div className="container narrow page auth-screen">
    <Intro eyebrow="WELCOME BACK" title={<>Sign in to<br/>Roshan Rozgar.</>} description="Use the email and password you signed up with."  icon={LogIn}/>
    <form className="panel auth-form" onSubmit={e=>{e.preventDefault();task.run(async()=>{
      const session=await api('/auth/signin','POST',{email:form.email,password:form.password});
      onAuth(session);navigate('/dashboard');
    });}}>
      <Field label="Email"><input required type="email" autoComplete="email" maxLength={120} value={form.email} onChange={e=>set('email',e.target.value)}/></Field>
      <PasswordField label="Password" autoComplete="current-password" value={form.password} onChange={v=>set('password',v)}/>
      <ErrorNote plain error={task.error}/>
      <button className="btn primary wide" disabled={task.pending}>{task.pending?'Signing in…':'Sign in'} <ArrowRight size={17}/></button>
      <p className="auth-switch">New here? <Link className="text-link" to="/signup">Create an account</Link></p>
    </form>
  </div>;
}

export function SignUp() {
  const {api,onAuth,account}=useDemo();
  const navigate=useNavigate();
  const [params]=useSearchParams();
  const task=useTask();
  const justSignedUp=useRef(false);
  const [form,setForm]=useState({role:params.get('role')==='worker'?'worker':'customer',name:'',email:'',phone:'',password:'',confirm:''});
  const set=(key,value)=>setForm(f=>({...f,[key]:value}));
  if (account&&!justSignedUp.current) return <Navigate to="/dashboard" replace/>;
  const mismatch=form.confirm.length>0&&form.confirm!==form.password;
  return <div className="container narrow page auth-screen">
    <Intro eyebrow="JOIN ROSHAN ROZGAR" title={<>Create your<br/>account.</>} description="Customers find trusted workers. Workers build a profile and get booked." icon={UserPlus}/>
    <form className="panel auth-form" onSubmit={e=>{e.preventDefault();
      if (form.password!==form.confirm) {task.setError('The two passwords do not match.');return;}
      task.run(async()=>{
        const {confirm,...body}=form;
        const session=await api('/auth/signup','POST',body);
        justSignedUp.current=true;
        onAuth(session);
        navigate(session.user.role==='worker'?'/onboard':'/find');
      });}}>
      <fieldset className="role-picker"><legend>I want to…</legend>
        <div className="trade-tiles two">
          <button type="button" className={'tile '+(form.role==='customer'?'selected':'')} aria-pressed={form.role==='customer'} onClick={()=>set('role','customer')}><UserRound size={20}/><span>Hire a worker</span></button>
          <button type="button" className={'tile '+(form.role==='worker'?'selected':'')} aria-pressed={form.role==='worker'} onClick={()=>set('role','worker')}><BriefcaseBusiness size={20}/><span>Find work</span></button>
        </div>
      </fieldset>
      <Field label="Full name"><input required minLength={2} maxLength={70} autoComplete="name" value={form.name} onChange={e=>set('name',e.target.value)}/></Field>
      <div className="fields">
        <Field label="Email"><input required type="email" autoComplete="email" maxLength={120} value={form.email} onChange={e=>set('email',e.target.value)}/></Field>
        <Field label="Mobile number · optional"><input type="tel" inputMode="tel" autoComplete="tel" placeholder="03XXXXXXXXX" pattern="(\+92|0)?3\d{9}" title="A Pakistani mobile number like 03XXXXXXXXX" value={form.phone} onChange={e=>set('phone',e.target.value)}/></Field>
      </div>
      <div className="fields">
        <PasswordField label="Password" autoComplete="new-password" hint="At least 8 characters." value={form.password} onChange={v=>set('password',v)}/>
        <PasswordField label="Confirm password" autoComplete="new-password" value={form.confirm} onChange={v=>set('confirm',v)}/>
      </div>
      {mismatch&&<p className="error" role="alert">The two passwords do not match.</p>}
      <ErrorNote plain error={task.error}/>
      <button className="btn primary wide" disabled={task.pending||mismatch}>{task.pending?'Creating account…':'Create account'} <ArrowRight size={17}/></button>
      <p className="auth-switch">Already have an account? <Link className="text-link" to="/signin">Sign in</Link></p>
    </form>
  </div>;
}
