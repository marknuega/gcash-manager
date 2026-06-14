import { useState, useEffect, useCallback } from "react";
import { MOCK } from "./config.js";
import { api, getToken, setToken } from "./api.js";

// ─────────────────────────────────────────────
// CONSTANTS & SEED DATA
// ─────────────────────────────────────────────
const C = {
  blue:"#0070BA", blueD:"#005A96", blueL:"#E8F4FD", blueMid:"#3A9FD9",
  green:"#00A859", greenL:"#E6F7EE",
  orange:"#F5A623", orangeL:"#FEF6E4",
  red:"#E02020", redL:"#FDEAEA",
  purple:"#7C3AED", purpleL:"#F3E8FF",
  teal:"#0891B2", tealL:"#E0F7FA",
  pink:"#DB2777", pinkL:"#FCE7F3",
  ink:"#1A1A2E", muted:"#6B7280",
  border:"#E5E7EB", bg:"#F0F4FA", white:"#FFFFFF",
};

const SERVICE_TYPES = {
  "cash-in":    { label:"Cash-In",       icon:"⬇️",  color:C.green,  bg:C.greenL,  floatEffect:+1, feeDefault:0   },
  "cash-out":   { label:"Cash-Out",      icon:"⬆️",  color:C.orange, bg:C.orangeL, floatEffect:-1, feeDefault:25  },
  "padala":     { label:"GCash Padala",  icon:"📲",  color:C.blue,   bg:C.blueL,   floatEffect:-1, feeDefault:30  },
  "pera-padala":{ label:"Pera Padala",   icon:"📤",  color:C.teal,   bg:C.tealL,   floatEffect:-1, feeDefault:50  },
  "bills":      { label:"Bills Payment", icon:"🧾",  color:C.purple, bg:C.purpleL, floatEffect:-1, feeDefault:15  },
  "load":       { label:"Load Selling",  icon:"📶",  color:C.pink,   bg:C.pinkL,   floatEffect:-1, feeDefault:5   },
};

const BILLS_LIST = [
  "Meralco","PLDT","Maynilad","Manila Water","SSS","PhilHealth",
  "Pag-IBIG","Globe Postpaid","Smart Postpaid","Converge","Sky Cable","Cignal",
];
const LOAD_NETWORKS = ["Globe","Smart","DITO","TNT","Sun","TM"];
const LOAD_DENOMINATIONS = [10,15,20,30,50,60,100,115,150,200,300,500,1000];
const PERA_PADALA_NETS = ["LBC","Palawan Express","M Lhuillier","Western Union","Cebuana Lhuillier","JRS Express"];

// Quick-charge presets: a repeat transaction amount paired with its usual
// charge, so common entries are one tap instead of typing. Tiers mirror the
// agent notebook (₱100→₱5, ₱500→₱10, ₱1,000→₱15, ₱2,000→₱30, ₱5,000→₱75…).
const DEFAULT_CHARGE_PRESETS = [
  {amount:100,  charge:5 },
  {amount:200,  charge:10},
  {amount:300,  charge:10},
  {amount:500,  charge:10},
  {amount:1000, charge:15},
  {amount:1500, charge:20},
  {amount:2000, charge:30},
  {amount:3000, charge:45},
  {amount:5000, charge:75},
];
// Presets are per outlet — give each seed outlet its own default set (MOCK mode).
const seedPresets = (outlets) =>
  outlets.flatMap(o=>DEFAULT_CHARGE_PRESETS.map(p=>({id:`${o.id}-p${p.amount}`,amount:p.amount,charge:p.charge,outlet:o.id})));

const SEED_OUTLETS = [
  {id:"o0", name:"Bulacan Main",      location:"Bulacan",             color:"#0070BA", isDefault:true},
  {id:"o1", name:"Divisoria Branch",  location:"Divisoria, Manila",  color:"#00A859"},
  {id:"o2", name:"Cubao Branch",      location:"Cubao, QC",           color:"#7C3AED"},
  {id:"o3", name:"Caloocan Branch",   location:"Caloocan City",       color:"#F5A623"},
  {id:"o4", name:"Pasay Branch",      location:"Pasay City",          color:"#0891B2"},
];

// The default branch: explicit isDefault flag, else a "Bulacan Main" name match
// (so it also resolves against server outlets), else the first outlet.
const getDefaultOutlet = (outlets=[]) =>
  outlets.find(o=>o.isDefault) || outlets.find(o=>/bulacan\s*main/i.test(o.name)) || outlets[0] || null;

// ACCOUNTS: owner + one cashier per outlet
const SEED_ACCOUNTS = [
  {id:"a0", name:"Owner / Admin",    username:"admin",   password:"admin123",  role:"admin",   outlet:null},
  {id:"a1", name:"Maria Santos",     username:"maria",   password:"pass1234",  role:"cashier", outlet:"o1"},
  {id:"a2", name:"Juan dela Cruz",   username:"juan",    password:"pass1234",  role:"cashier", outlet:"o2"},
  {id:"a3", name:"Ana Reyes",        username:"ana",     password:"pass1234",  role:"cashier", outlet:"o3"},
  {id:"a4", name:"Pedro Garcia",     username:"pedro",   password:"pass1234",  role:"cashier", outlet:"o4"},
];

const SEED_FLOATS = {o0:20000, o1:15000, o2:12000, o3:18000, o4:10000};

const SEED_TXN = [
  {id:"t1",type:"cash-in",   amount:500,  fee:0,  outlet:"o1",accountId:"a1",customerName:"Rosa Lim",   note:"",          subType:"",       date:new Date(Date.now()-86400000*2).toISOString()},
  {id:"t2",type:"padala",    amount:2000, fee:30, outlet:"o2",accountId:"a2",customerName:"Ben Tan",    note:"To Cebu",   subType:"",       date:new Date(Date.now()-86400000).toISOString()},
  {id:"t3",type:"bills",     amount:1200, fee:15, outlet:"o1",accountId:"a1",customerName:"Lita Cruz",  note:"Meralco",   subType:"Meralco",date:new Date(Date.now()-3600000).toISOString()},
  {id:"t4",type:"cash-out",  amount:3000, fee:25, outlet:"o3",accountId:"a3",customerName:"Joey Ramos", note:"",          subType:"",       date:new Date().toISOString()},
  {id:"t5",type:"load",      amount:100,  fee:5,  outlet:"o4",accountId:"a4",customerName:"Nena Cruz",  note:"09171234567",subType:"Globe",  date:new Date().toISOString()},
  {id:"t6",type:"pera-padala",amount:5000,fee:50, outlet:"o2",accountId:"a2",customerName:"Aling Rosa", note:"To Leyte",  subType:"LBC",    date:new Date().toISOString()},
];

const SEED_CUSTOMERS = [
  {id:"c1",name:"Rosa Lim",   phone:"09161111111",address:"Tondo, Manila", note:"Regular"},
  {id:"c2",name:"Ben Tan",    phone:"09272222222",address:"Makati",        note:""},
  {id:"c3",name:"Lita Cruz",  phone:"09383333333",address:"Pasig",         note:"Senior"},
];

// ─────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────
const KEYS = {accounts:"gm_accounts",outlets:"gm_outlets",txns:"gm_txns",customers:"gm_customers",floats:"gm_floats",presets:"gm_presets"};
const ls = {
  get:(k,d)=>{ try{const v=localStorage.getItem(k); return v?JSON.parse(v):d;}catch{return d;} },
  set:(k,v)=>{ try{localStorage.setItem(k,JSON.stringify(v));}catch{} },
};

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
const uid  = ()=>Math.random().toString(36).slice(2,9);
const peso = n=>"₱"+Number(n).toLocaleString("en-PH",{minimumFractionDigits:2});
const fmt  = iso=>new Date(iso).toLocaleString("en-PH",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const todayStr = ()=>new Date().toISOString().slice(0,10);

// ─────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────
const Badge = ({color,bg,children,style})=>(
  <span style={{background:bg,color,fontSize:11,fontWeight:700,borderRadius:99,padding:"2px 10px",whiteSpace:"nowrap",...style}}>{children}</span>
);
const Card = ({children,style})=>(
  <div style={{background:C.white,borderRadius:16,boxShadow:"0 1px 6px rgba(0,0,0,.07)",padding:20,...style}}>{children}</div>
);
const Btn = ({onClick,variant="primary",children,style,disabled,small})=>{
  const base = {borderRadius:9,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1,border:"none",transition:"all .15s",padding:small?"6px 12px":"9px 20px",fontSize:small?12:13};
  const vars = {
    primary:{background:C.blue,color:"#fff"},
    ghost:{background:"transparent",color:C.blue,border:`1.5px solid ${C.blue}`},
    danger:{background:C.red,color:"#fff"},
    success:{background:C.green,color:"#fff"},
    orange:{background:C.orange,color:"#fff"},
    dark:{background:C.ink,color:"#fff"},
  };
  return <button onClick={onClick} disabled={disabled} style={{...base,...vars[variant],...style}}>{children}</button>;
};
const Inp = ({label,value,onChange,type="text",placeholder,req,full=true})=>(
  <div style={{marginBottom:12}}>
    {label&&<div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4}}>{label}{req&&<span style={{color:C.red}}> *</span>}</div>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:full?"100%":"auto",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:14,background:C.bg,boxSizing:"border-box",outline:"none"}}/>
  </div>
);
const Sel = ({label,value,onChange,options,req})=>(
  <div style={{marginBottom:12}}>
    {label&&<div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4}}>{label}{req&&<span style={{color:C.red}}> *</span>}</div>}
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:14,background:C.bg,boxSizing:"border-box"}}>
      <option value="">-- Select --</option>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
const Modal = ({title,onClose,children,wide})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:C.white,borderRadius:18,padding:24,width:"100%",maxWidth:wide?600:460,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 12px 48px rgba(0,0,0,.22)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{fontWeight:800,fontSize:17,color:C.ink}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:C.muted,lineHeight:1}}>×</button>
      </div>
      {children}
    </div>
  </div>
);
const StatBox = ({icon,label,value,color=C.blue,sub})=>(
  <Card style={{display:"flex",flexDirection:"column",gap:3}}>
    <div style={{fontSize:24}}>{icon}</div>
    <div style={{fontSize:22,fontWeight:900,color}}>{value}</div>
    <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.4}}>{label}</div>
    {sub&&<div style={{fontSize:11,color:C.muted}}>{sub}</div>}
  </Card>
);
const Toast = ({msg,type="success"})=>(
  <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:type==="success"?C.green:C.red,color:"#fff",borderRadius:12,padding:"12px 24px",fontWeight:700,fontSize:14,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,.25)",whiteSpace:"nowrap"}}>
    {type==="success"?"✅":"❌"} {msg}
  </div>
);

// ─────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────
function LoginScreen({accounts,onLogin}){
  const [user,setUser]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");

  const login=async()=>{
    setErr("");
    if(MOCK){
      const acc=accounts.find(a=>a.username===user.trim().toLowerCase()&&a.password===pass);
      if(!acc){setErr("Invalid username or password."); return;}
      onLogin(acc);
      return;
    }
    try{
      const {token,user:u}=await api.post("/auth/login",{username:user.trim(),password:pass});
      setToken(token);
      onLogin(u);
    }catch(e){ setErr(e.message||"Login failed."); }
  };

  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${C.blue} 0%,${C.blueMid} 50%,${C.green} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.white,borderRadius:24,padding:32,width:"100%",maxWidth:380,boxShadow:"0 16px 64px rgba(0,0,0,.2)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:64,height:64,borderRadius:20,background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",boxShadow:`0 4px 16px ${C.blue}55`}}>
            <span style={{fontSize:32,color:"#fff",fontWeight:900}}>G</span>
          </div>
          <div style={{fontWeight:900,fontSize:22,color:C.ink}}>GCash Business Manager</div>
          <div style={{color:C.muted,fontSize:13,marginTop:4}}>Sign in to your outlet account</div>
        </div>
        <Inp label="Username" value={user} onChange={setUser} placeholder="e.g. maria" req/>
        <Inp label="Password" value={pass} onChange={v=>{setPass(v);setErr("");}} type="password" placeholder="••••••••" req/>
        {err&&<div style={{color:C.red,fontSize:13,marginBottom:10,fontWeight:600}}>{err}</div>}
        <Btn onClick={login} style={{width:"100%",padding:"12px",fontSize:15}}>Sign In</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TRANSACTION FORM (smart multi-step)
// ─────────────────────────────────────────────
function TxnForm({onSave,onClose,outlets,accounts,currentUser,floats,defaultOutletId}){
  const [step,setStep]=useState(1); // 1=service, 2=details
  const [type,setType]=useState("");
  const [form,setForm]=useState({amount:"",fee:"",customerName:"",customerPhone:"",note:"",subType:"",outletId:currentUser.role==="cashier"?currentUser.outlet:(defaultOutletId||""),accountId:currentUser.id});
  const [toast,setToast]=useState(null);

  const svc = type?SERVICE_TYPES[type]:null;
  const isAdmin = currentUser.role==="admin";
  const availOutlets = isAdmin?outlets:outlets.filter(o=>o.id===currentUser.outlet);
  const assignedAccounts = accounts.filter(a=>a.outlet===form.outletId&&a.role==="cashier");

  const setF=useCallback((k,v)=>setForm(p=>({...p,[k]:v})),[]);

  const selectService=(t)=>{
    setType(t);
    setF("fee", SERVICE_TYPES[t].feeDefault.toString());
    setStep(2);
  };

  const save=()=>{
    if(!type||!form.amount||!form.outletId||!form.accountId){
      setToast({msg:"Fill all required fields.",type:"error"});
      setTimeout(()=>setToast(null),2500);
      return;
    }
    const amt=Number(form.amount);
    const fee=Number(form.fee||0);
    const effect=SERVICE_TYPES[type].floatEffect;
    const curFloat=floats[form.outletId]||0;
    const newFloat=curFloat+(effect*amt)+fee;
    onSave({txn:{id:uid(),type,amount:amt,fee,outlet:form.outletId,accountId:form.accountId,customerName:form.customerName,customerPhone:form.customerPhone,note:form.note,subType:form.subType,date:new Date().toISOString()},outletId:form.outletId,newFloat});
  };

  // Step 1 – pick service
  if(step===1) return(
    <Modal title="New Transaction – Choose Service" onClose={onClose} wide>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
        {Object.entries(SERVICE_TYPES).map(([key,s])=>(
          <button key={key} onClick={()=>selectService(key)}
            style={{background:s.bg,border:`2px solid ${s.color}22`,borderRadius:14,padding:"18px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:8,transition:"all .15s"}}>
            <span style={{fontSize:32}}>{s.icon}</span>
            <span style={{fontWeight:700,color:s.color,fontSize:13}}>{s.label}</span>
          </button>
        ))}
      </div>
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
    </Modal>
  );

  // Step 2 – fill details
  return(
    <Modal title={`${svc?.icon} ${svc?.label}`} onClose={onClose}>
      <div style={{background:svc?.bg,borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
        <span style={{fontSize:28}}>{svc?.icon}</span>
        <div>
          <div style={{fontWeight:700,color:svc?.color}}>{svc?.label}</div>
          <div style={{fontSize:12,color:C.muted}}>Float effect: {svc?.floatEffect>0?"Increases":"Decreases"} your cash</div>
        </div>
        <Btn onClick={()=>setStep(1)} variant="ghost" small style={{marginLeft:"auto"}}>← Change</Btn>
      </div>

      {isAdmin&&(
        <Sel label="Outlet" value={form.outletId} onChange={v=>setF("outletId",v)} req
          options={availOutlets.map(o=>({value:o.id,label:o.name}))}/>
      )}
      {isAdmin&&form.outletId&&(
        <Sel label="Staff (who handled this)" value={form.accountId} onChange={v=>setF("accountId",v)} req
          options={[currentUser,...assignedAccounts].filter((a,i,arr)=>arr.findIndex(b=>b.id===a.id)===i).map(a=>({value:a.id,label:a.name}))}/>
      )}

      {/* Sub-type pickers */}
      {type==="bills"&&(
        <Sel label="Biller" value={form.subType} onChange={v=>setF("subType",v)} req
          options={BILLS_LIST.map(b=>({value:b,label:b}))}/>
      )}
      {type==="load"&&(<>
        <Sel label="Network" value={form.subType} onChange={v=>setF("subType",v)} req
          options={LOAD_NETWORKS.map(n=>({value:n,label:n}))}/>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:6}}>Quick Amount</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {LOAD_DENOMINATIONS.map(d=>(
              <button key={d} onClick={()=>setF("amount",d.toString())}
                style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${form.amount==d?C.pink:C.border}`,background:form.amount==d?C.pinkL:C.bg,fontWeight:700,fontSize:13,cursor:"pointer",color:form.amount==d?C.pink:C.ink}}>
                ₱{d}
              </button>
            ))}
          </div>
        </div>
        <Inp label="Mobile Number to Load" value={form.note} onChange={v=>setF("note",v)} placeholder="09xxxxxxxxx" req/>
      </>)}
      {type==="pera-padala"&&(
        <Sel label="Remittance Partner" value={form.subType} onChange={v=>setF("subType",v)} req
          options={PERA_PADALA_NETS.map(n=>({value:n,label:n}))}/>
      )}

      <Inp label="Amount (₱)" type="number" value={form.amount} onChange={v=>setF("amount",v)} req/>
      <Inp label="Service Fee (₱)" type="number" value={form.fee} onChange={v=>setF("fee",v)}/>
      <Inp label="Customer Name" value={form.customerName} onChange={v=>setF("customerName",v)}/>
      <Inp label="Customer Phone" value={form.customerPhone} onChange={v=>setF("customerPhone",v)} placeholder="09xxxxxxxxx"/>
      {type!=="load"&&<Inp label="Note" value={form.note} onChange={v=>setF("note",v)} placeholder={type==="padala"?"e.g. To Cebu":type==="bills"?"Account / Reference No.":"Optional note"}/>}

      {/* Float preview */}
      {form.outletId&&form.amount&&(
        <div style={{background:C.bg,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13}}>
          <span style={{color:C.muted}}>Current float: <strong>{peso(floats[form.outletId]||0)}</strong></span>
          {"  →  "}
          <span style={{color:C.green,fontWeight:700}}>
            {peso((floats[form.outletId]||0)+(SERVICE_TYPES[type].floatEffect*Number(form.amount||0))+Number(form.fee||0))}
          </span>
        </div>
      )}

      <div style={{display:"flex",gap:10}}>
        <Btn onClick={save} variant="success" style={{flex:1}}>Save Transaction</Btn>
        <Btn onClick={onClose} variant="ghost">Cancel</Btn>
      </div>
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
    </Modal>
  );
}

// ─────────────────────────────────────────────
// LEDGER ENTRY FORM (quick passbook-style add: In/Out + Charge)
// Mirrors the notebook: pick a direction, an amount, and the charge.
// In  → cash-in (cash received, drawer up) · Out → cash-out (cash handed out).
// ─────────────────────────────────────────────
function LedgerEntryForm({onSave,onClose,outlets,currentUser,floats,defaultOutletId,initial}){
  const isAdmin=currentUser.role==="admin";
  const availOutlets=isAdmin?outlets:outlets.filter(o=>o.id===currentUser.outlet);
  const [dir,setDir]=useState("in");          // "in" | "out"
  const [form,setForm]=useState({
    amount: initial?.amount!=null?String(initial.amount):"",
    charge: initial?.charge!=null?String(initial.charge):"",
    customerName:"", note:"", date:todayStr(),
    outletId: initial?.outletId || (isAdmin ? (defaultOutletId||"") : currentUser.outlet),
  });
  const [toast,setToast]=useState(null);
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));

  const type = dir==="in" ? "cash-in" : "cash-out";
  const effect = SERVICE_TYPES[type].floatEffect;
  const amt=Number(form.amount||0), chg=Number(form.charge||0);
  const curFloat=floats[form.outletId]||0;
  const newFloat=curFloat+(effect*amt)+chg;

  const save=()=>{
    if(!form.outletId||!(amt>0)){
      setToast({msg:"Pick a branch and enter an amount.",type:"error"});
      setTimeout(()=>setToast(null),2500);
      return;
    }
    // Build an ISO timestamp on the chosen day (MOCK keeps the date; the server
    // timestamps server-side, so real-mode entries are dated today).
    const date = form.date===todayStr()
      ? new Date().toISOString()
      : new Date(form.date+"T12:00:00").toISOString();
    onSave({
      txn:{id:uid(),type,amount:amt,fee:chg,outlet:form.outletId,accountId:currentUser.id,
        customerName:form.customerName,customerPhone:"",note:form.note,subType:"",date},
      outletId:form.outletId,newFloat,
    });
  };

  return(
    <Modal title="📒 Ledger Entry" onClose={onClose}>
      <div style={{fontSize:12,color:C.muted,marginBottom:14}}>Quick passbook entry — In or Out, plus your charge.</div>

      {/* Direction toggle */}
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        {[{k:"in",l:"⬇️ In (cash received)",c:C.green,bg:C.greenL},{k:"out",l:"⬆️ Out (cash given)",c:C.orange,bg:C.orangeL}].map(d=>(
          <button key={d.k} onClick={()=>setDir(d.k)}
            style={{flex:1,padding:"12px 8px",borderRadius:12,cursor:"pointer",fontWeight:800,fontSize:13,
              border:`2px solid ${dir===d.k?d.c:C.border}`,background:dir===d.k?d.bg:C.white,color:dir===d.k?d.c:C.muted}}>
            {d.l}
          </button>
        ))}
      </div>

      {isAdmin&&(
        <Sel label="Branch" value={form.outletId} onChange={v=>setF("outletId",v)} req
          options={availOutlets.map(o=>({value:o.id,label:o.name+(getDefaultOutlet(outlets)?.id===o.id?" (Default)":"")}))}/>
      )}

      <Inp label={dir==="in"?"Amount In (₱)":"Amount Out (₱)"} type="number" value={form.amount} onChange={v=>setF("amount",v)} req/>
      <Inp label="Charge / Fee (₱)" type="number" value={form.charge} onChange={v=>setF("charge",v)}/>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4}}>Date</div>
        <input type="date" value={form.date} onChange={e=>setF("date",e.target.value)}
          style={{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:14,background:C.bg,boxSizing:"border-box"}}/>
      </div>
      <Inp label="Customer Name (optional)" value={form.customerName} onChange={v=>setF("customerName",v)}/>
      <Inp label="Note (optional)" value={form.note} onChange={v=>setF("note",v)}/>

      {form.outletId&&amt>0&&(
        <div style={{background:C.bg,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13}}>
          <span style={{color:C.muted}}>Float: <strong>{peso(curFloat)}</strong></span>{"  →  "}
          <span style={{color:C.green,fontWeight:700}}>{peso(newFloat)}</span>
          {chg>0&&<span style={{color:C.blue,fontWeight:700}}>  · +{peso(chg)} kita</span>}
        </div>
      )}

      <div style={{display:"flex",gap:10}}>
        <Btn onClick={save} variant="success" style={{flex:1}}>Save Entry</Btn>
        <Btn onClick={onClose} variant="ghost">Cancel</Btn>
      </div>
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
    </Modal>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App(){
  const [accounts,  setAccounts]  = useState(()=>MOCK?ls.get(KEYS.accounts,  SEED_ACCOUNTS):[]);
  const [outlets,   setOutlets]   = useState(()=>MOCK?ls.get(KEYS.outlets,   SEED_OUTLETS):[]);
  const [txns,      setTxns]      = useState(()=>MOCK?ls.get(KEYS.txns,      SEED_TXN):[]);
  const [customers, setCustomers] = useState(()=>MOCK?ls.get(KEYS.customers, SEED_CUSTOMERS):[]);
  const [floats,    setFloats]    = useState(()=>MOCK?ls.get(KEYS.floats,    SEED_FLOATS):{});
  const [presets,   setPresets]   = useState(()=>MOCK?ls.get(KEYS.presets, seedPresets(SEED_OUTLETS)):[]);
  const [session,   setSession]   = useState(null);
  const [tab,       setTab]       = useState("dashboard");
  const [toast,     setToast]     = useState(null);

  // MOCK mode persists offline to localStorage. Real mode: the server is the
  // source of truth, so don't shadow it with stale localStorage.
  useEffect(()=>{ if(MOCK) ls.set(KEYS.accounts, accounts);  },[accounts]);
  useEffect(()=>{ if(MOCK) ls.set(KEYS.outlets,  outlets);   },[outlets]);
  useEffect(()=>{ if(MOCK) ls.set(KEYS.txns,     txns);      },[txns]);
  useEffect(()=>{ if(MOCK) ls.set(KEYS.customers,customers); },[customers]);
  useEffect(()=>{ if(MOCK) ls.set(KEYS.floats,   floats);    },[floats]);
  // MOCK keeps presets in localStorage; real mode loads them from the server.
  useEffect(()=>{ if(MOCK) ls.set(KEYS.presets, presets); },[presets]);

  const addPreset=async(p)=>{
    if(MOCK){ setPresets(prev=>[...prev,{id:uid(),amount:Number(p.amount),charge:Number(p.charge),outlet:p.outlet}]); return; }
    const created=await api.post("/presets",{amount:Number(p.amount),charge:Number(p.charge),outlet:p.outlet});
    setPresets(prev=>[...prev,created].sort((a,b)=>a.amount-b.amount));
  };
  const deletePreset=async(id)=>{
    if(!MOCK) await api.del(`/presets/${id}`);
    setPresets(prev=>prev.filter(p=>p.id!==id));
  };

  const showToast=(msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),2500); };

  // ── pull all data from the server (real mode) ──
  const loadState=useCallback(async()=>{
    if(MOCK||!getToken()) return;
    try{
      const s=await api.get("/state");
      setAccounts(s.accounts); setOutlets(s.outlets); setTxns(s.txns);
      setCustomers(s.customers); setFloats(s.floats); setPresets(s.presets||[]);
    }catch{ /* 401 handled via the gm-unauthorized event */ }
  },[]);

  // After login (real mode): load, then poll + refetch on focus so every phone
  // and outlet sees the same live data.
  useEffect(()=>{
    if(MOCK||!session) return;
    loadState();
    const iv=setInterval(loadState,20000);
    const onFocus=()=>loadState();
    window.addEventListener("focus",onFocus);
    return ()=>{ clearInterval(iv); window.removeEventListener("focus",onFocus); };
  },[session,loadState]);

  // Token expired server-side -> back to the login screen.
  useEffect(()=>{
    const onUnauth=()=>{ setToken(null); setSession(null); };
    window.addEventListener("gm-unauthorized",onUnauth);
    return ()=>window.removeEventListener("gm-unauthorized",onUnauth);
  },[]);

  const logout=()=>{ setToken(null); setSession(null); };

  // ── data actions: identical behavior in MOCK; hit the API in real mode ──
  const addTxn=async({txn,outletId,newFloat})=>{
    if(MOCK){
      setTxns(p=>[txn,...p]);
      setFloats(p=>({...p,[outletId]:newFloat}));
      showToast("Transaction saved!");
      return;
    }
    try{
      const r=await api.post("/transactions",{type:txn.type,amount:txn.amount,fee:txn.fee,outlet:txn.outlet,accountId:txn.accountId,customerName:txn.customerName,customerPhone:txn.customerPhone,note:txn.note,subType:txn.subType});
      setTxns(p=>[r.txn,...p]);
      setFloats(p=>({...p,[r.outletId]:r.float}));
      showToast("Transaction saved!");
    }catch(e){ showToast(e.message||"Could not save transaction.","error"); }
  };

  const setFloat=async(outletId,value)=>{
    if(MOCK){ setFloats(p=>({...p,[outletId]:value})); return; }
    const r=await api.put(`/floats/${outletId}`,{balance:value});
    setFloats(p=>({...p,[r.outletId]:r.float}));
  };

  const addCustomer=async(form)=>{
    if(MOCK){ setCustomers(p=>[{id:uid(),...form},...p]); return; }
    const c=await api.post("/customers",form);
    setCustomers(p=>[c,...p]);
  };
  const deleteCustomer=async(id)=>{
    if(!MOCK) await api.del(`/customers/${id}`);
    setCustomers(p=>p.filter(c=>c.id!==id));
  };

  const addOutlet=async(form)=>{
    if(MOCK){ setOutlets(p=>[...p,{id:uid(),...form}]); return; }
    const o=await api.post("/outlets",form);
    setOutlets(p=>[...p,o]);
  };
  const deleteOutlet=async(id)=>{
    if(!MOCK) await api.del(`/outlets/${id}`);
    setOutlets(p=>p.filter(o=>o.id!==id));
  };

  const saveAccount=async(editId,form)=>{
    if(MOCK){
      if(editId) setAccounts(p=>p.map(a=>a.id===editId?{...a,...form,outlet:form.outlet||null}:a));
      else setAccounts(p=>[...p,{id:uid(),...form,outlet:form.outlet||null}]);
      return;
    }
    if(editId){ const a=await api.patch(`/accounts/${editId}`,form); setAccounts(p=>p.map(x=>x.id===editId?a:x)); }
    else { const a=await api.post("/accounts",form); setAccounts(p=>[...p,a]); }
  };
  const deleteAccount=async(id)=>{
    if(!MOCK) await api.del(`/accounts/${id}`);
    setAccounts(p=>p.filter(a=>a.id!==id));
  };

  if(!session) return <LoginScreen accounts={accounts} onLogin={setSession}/>;

  const isAdmin = session.role==="admin";

  // Only the owner (admin) sees every branch. A non-owner account sees ONLY its
  // own transactions and its own outlet.
  const visibleTxns = isAdmin ? txns : txns.filter(t=>t.accountId===session.id);
  const visibleOutlets = isAdmin ? outlets : outlets.filter(o=>o.id===session.outlet);

  const TABS = isAdmin
    ? [{id:"dashboard",l:"📊 Dashboard"},{id:"txns",l:"💸 Transactions"},{id:"ledger",l:"📒 Ledger"},{id:"float",l:"💰 Float"},{id:"staff",l:"👥 Staff"},{id:"customers",l:"📋 Customers"},{id:"outlets",l:"🏪 Outlets"},{id:"accounts",l:"🔐 Accounts"},{id:"reports",l:"📄 Reports"}]
    : [{id:"dashboard",l:"📊 My Outlet"},{id:"txns",l:"💸 Transactions"},{id:"ledger",l:"📒 Ledger"},{id:"customers",l:"📋 Customers"},{id:"reports",l:"📄 Reports"}];

  const defaultOutletId = getDefaultOutlet(visibleOutlets)?.id || null;
  const ctx={accounts,outlets,txns,customers,floats,presets,session,isAdmin,visibleTxns,visibleOutlets,defaultOutletId,addTxn,setFloat,addCustomer,deleteCustomer,addOutlet,deleteOutlet,saveAccount,deleteAccount,addPreset,deletePreset,showToast};

  return(
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:C.bg,minHeight:"100vh",color:C.ink}}>
      {/* Header */}
      <div style={{background:`linear-gradient(90deg,${C.blue},${C.blueMid})`,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 12px rgba(0,112,186,.35)"}}>
        <div style={{background:"rgba(255,255,255,.2)",borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,color:"#fff"}}>G</div>
        <div style={{flex:1}}>
          <div style={{color:"#fff",fontWeight:800,fontSize:15}}>GCash Business Manager</div>
          <div style={{color:"rgba(255,255,255,.75)",fontSize:11}}>
            {isAdmin?"Owner View – All Outlets":`${visibleOutlets[0]?.name} · ${session.name}`}
          </div>
        </div>
        <Btn onClick={logout} variant="ghost" small style={{color:"#fff",border:"1.5px solid rgba(255,255,255,.5)"}}>Sign Out</Btn>
      </div>

      {/* Nav */}
      <div style={{display:"flex",overflowX:"auto",background:C.white,borderBottom:`1px solid ${C.border}`,padding:"0 8px",gap:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"12px 14px",border:"none",background:"none",cursor:"pointer",fontWeight:tab===t.id?800:500,color:tab===t.id?C.blue:C.muted,borderBottom:tab===t.id?`3px solid ${C.blue}`:"3px solid transparent",fontSize:13,whiteSpace:"nowrap",transition:"all .15s"}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Page */}
      <div style={{padding:"20px 14px",maxWidth:920,margin:"0 auto"}}>
        {tab==="dashboard"  && <Dashboard ctx={ctx}/>}
        {tab==="txns"       && <Transactions ctx={ctx}/>}
        {tab==="ledger"     && <Ledger ctx={ctx}/>}
        {tab==="float"      && <FloatTracker ctx={ctx}/>}
        {tab==="staff"      && <StaffPanel ctx={ctx}/>}
        {tab==="customers"  && <CustomerLedger ctx={ctx}/>}
        {tab==="outlets"    && <OutletManager ctx={ctx}/>}
        {tab==="accounts"   && <AccountManager ctx={ctx}/>}
        {tab==="reports"    && <Reports ctx={ctx}/>}
      </div>

      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
    </div>
  );
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
function Dashboard({ctx}){
  const {visibleTxns,visibleOutlets,floats,accounts,session,isAdmin}=ctx;
  const todayT=visibleTxns.filter(t=>t.date.startsWith(todayStr()));
  const fees=todayT.reduce((s,t)=>s+Number(t.fee||0),0);
  const vol =todayT.reduce((s,t)=>s+Number(t.amount),0);
  const totalFloat=visibleOutlets.reduce((s,o)=>s+Number(floats[o.id]||0),0);

  const byType=Object.entries(SERVICE_TYPES).map(([key,s])=>{
    const t=todayT.filter(x=>x.type===key);
    return{key,label:s.label,icon:s.icon,color:s.color,bg:s.bg,count:t.length,vol:t.reduce((a,x)=>a+Number(x.amount),0),fees:t.reduce((a,x)=>a+Number(x.fee||0),0)};
  });

  return(
    <div>
      <div style={{fontWeight:800,fontSize:20,marginBottom:16}}>
        {isAdmin?"Today's Overview":"My Outlet – Today"}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12,marginBottom:20}}>
        <StatBox icon="💵" label="Revenue Today" value={peso(fees)} color={C.green} sub="from fees"/>
        <StatBox icon="📦" label="Transactions" value={todayT.length} color={C.blue} sub="today"/>
        <StatBox icon="🔄" label="Volume" value={peso(vol)} color={C.purple} sub="today"/>
        <StatBox icon="💰" label="Total Float" value={peso(totalFloat)} color={C.orange} sub="all outlets"/>
      </div>

      {/* Per outlet (admin) */}
      {isAdmin&&(
        <Card style={{marginBottom:16}}>
          <div style={{fontWeight:700,marginBottom:12}}>📍 Outlet Snapshot</div>
          {visibleOutlets.map(o=>{
            const ot=todayT.filter(t=>t.outlet===o.id);
            const of=ot.reduce((s,t)=>s+Number(t.fee||0),0);
            const fl=floats[o.id]||0;
            const low=fl<5000;
            return(
              <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`,flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:o.color}}/>
                    <span style={{fontWeight:700}}>{o.name}</span>
                    {low&&<Badge color={C.orange} bg={C.orangeL}>⚠️ Low Float</Badge>}
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginLeft:18}}>{ot.length} txns · Float: {peso(fl)}</div>
                </div>
                <div style={{fontWeight:800,color:C.green,fontSize:16}}>{peso(of)} <span style={{fontWeight:400,fontSize:12,color:C.muted}}>earned</span></div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Service breakdown */}
      <Card>
        <div style={{fontWeight:700,marginBottom:12}}>📊 Services Breakdown Today</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
          {byType.filter(b=>b.count>0||true).map(b=>(
            <div key={b.key} style={{background:b.bg,borderRadius:12,padding:"12px 14px",opacity:b.count===0?.45:1}}>
              <div style={{fontSize:22}}>{b.icon}</div>
              <div style={{fontWeight:700,color:b.color,fontSize:14}}>{b.label}</div>
              <div style={{fontSize:13,color:C.ink,marginTop:2}}>{b.count} txn{b.count!==1?"s":""}</div>
              <div style={{fontSize:12,color:C.green,fontWeight:600}}>{peso(b.fees)} fees</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────
function Transactions({ctx}){
  const {visibleTxns,visibleOutlets,accounts,floats,session,isAdmin,addTxn,outlets,defaultOutletId,presets,addPreset,deletePreset,showToast}=ctx;
  const [modal,setModal]=useState(false);
  const [ledgerModal,setLedgerModal]=useState(false);
  const [ledgerInit,setLedgerInit]=useState(null);   // prefill from a charge preset
  const [editPresets,setEditPresets]=useState(false);
  const [newPreset,setNewPreset]=useState({amount:"",charge:""});
  // Which branch's preset list is shown/edited. Cashier is locked to their own.
  const [presetOutlet,setPresetOutlet]=useState(isAdmin?(defaultOutletId||visibleOutlets[0]?.id||""):session.outlet);
  const [fOut,setFOut]=useState("");
  const [fType,setFType]=useState("");
  const [fDate,setFDate]=useState(todayStr());
  const [search,setSearch]=useState("");

  const filtered=visibleTxns.filter(t=>{
    const mo=!fOut||t.outlet===fOut;
    const mt=!fType||t.type===fType;
    const md=!fDate||t.date.startsWith(fDate);
    const ms=!search||(t.customerName||"").toLowerCase().includes(search.toLowerCase())||(t.note||"").toLowerCase().includes(search.toLowerCase())||(t.subType||"").toLowerCase().includes(search.toLowerCase());
    return mo&&mt&&md&&ms;
  });

  const totalFees=filtered.reduce((s,t)=>s+Number(t.fee||0),0);
  const totalVol =filtered.reduce((s,t)=>s+Number(t.amount),0);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:20}}>Transactions</div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={()=>{setLedgerInit(null);setLedgerModal(true);}} variant="ghost">📒 Ledger Entry</Btn>
          <Btn onClick={()=>setModal(true)}>+ New Transaction</Btn>
        </div>
      </div>

      {/* ── Quick Charge presets (per branch) ── tap a repeat amount ── */}
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <div style={{fontWeight:700}}>⚡ Quick Charge {isAdmin&&<span style={{fontWeight:500,color:C.muted,fontSize:13}}>· {outlets.find(o=>o.id===presetOutlet)?.name||"—"}</span>}</div>
          <button onClick={()=>setEditPresets(e=>!e)}
            style={{background:"none",border:"none",color:C.blue,fontWeight:700,fontSize:12,cursor:"pointer"}}>
            {editPresets?"Done":"Edit"}
          </button>
        </div>
        {isAdmin&&visibleOutlets.length>1&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            {visibleOutlets.map(o=>(
              <button key={o.id} onClick={()=>setPresetOutlet(o.id)}
                style={{padding:"5px 12px",borderRadius:99,border:`1.5px solid ${presetOutlet===o.id?C.blue:C.border}`,
                  background:presetOutlet===o.id?C.blue:C.white,color:presetOutlet===o.id?"#fff":C.muted,fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
                {o.name}
              </button>
            ))}
          </div>
        )}
        <div style={{fontSize:12,color:C.muted,marginBottom:12}}>Tap an amount to start a ledger entry with its charge already filled in.</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(108px,1fr))",gap:10}}>
          {presets.filter(p=>p.outlet===presetOutlet).map(p=>(
            <div key={p.id} style={{position:"relative"}}>
              <button onClick={()=>{setLedgerInit({amount:p.amount,charge:p.charge,outletId:presetOutlet});setLedgerModal(true);}}
                style={{width:"100%",background:C.blueL,border:`1.5px solid ${C.blue}33`,borderRadius:12,padding:"12px 8px",cursor:"pointer",textAlign:"center"}}>
                <div style={{fontWeight:900,fontSize:17,color:C.blue}}>{peso(p.amount)}</div>
                <div style={{fontSize:12,color:C.green,fontWeight:700,marginTop:2}}>+{peso(p.charge)} charge</div>
              </button>
              {editPresets&&(
                <button onClick={async()=>{try{await deletePreset(p.id);}catch(e){showToast(e.message||"Could not remove preset.","error");}}} title="Remove"
                  style={{position:"absolute",top:-7,right:-7,width:22,height:22,borderRadius:"50%",border:"none",background:C.red,color:"#fff",fontWeight:900,fontSize:13,cursor:"pointer",lineHeight:1}}>×</button>
              )}
            </div>
          ))}
          {presets.filter(p=>p.outlet===presetOutlet).length===0&&<div style={{fontSize:13,color:C.muted}}>No presets for this branch. Add one →</div>}
        </div>
        {editPresets&&(
          <div style={{display:"flex",gap:8,alignItems:"flex-end",marginTop:14,flexWrap:"wrap"}}>
            <div style={{flex:"1 1 120px"}}><div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4}}>Amount (₱)</div>
              <input type="number" value={newPreset.amount} onChange={e=>setNewPreset(p=>({...p,amount:e.target.value}))}
                style={{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:14,background:C.bg,boxSizing:"border-box"}}/></div>
            <div style={{flex:"1 1 120px"}}><div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4}}>Charge (₱)</div>
              <input type="number" value={newPreset.charge} onChange={e=>setNewPreset(p=>({...p,charge:e.target.value}))}
                style={{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:14,background:C.bg,boxSizing:"border-box"}}/></div>
            <Btn variant="success" onClick={async()=>{
              if(!presetOutlet){showToast("Pick a branch first.","error");return;}
              if(!(Number(newPreset.amount)>0)){showToast("Enter a valid amount.","error");return;}
              try{ await addPreset({...newPreset,outlet:presetOutlet}); setNewPreset({amount:"",charge:""}); showToast("Preset added."); }
              catch(e){ showToast(e.message||"Could not add preset.","error"); }
            }}>+ Add Preset</Btn>
          </div>
        )}
      </Card>

      <Card style={{marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
          <Inp label="Search" value={search} onChange={setSearch} placeholder="Customer / note…"/>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4}}>Date</div>
            <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)}
              style={{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:14,background:C.bg,boxSizing:"border-box"}}/>
          </div>
          {isAdmin&&<Sel label="Outlet" value={fOut} onChange={setFOut} options={visibleOutlets.map(o=>({value:o.id,label:o.name}))}/>}
          <Sel label="Service" value={fType} onChange={setFType} options={Object.entries(SERVICE_TYPES).map(([k,v])=>({value:k,label:v.label}))}/>
        </div>
        <div style={{fontSize:13,color:C.muted,marginTop:2}}>
          {filtered.length} record(s) · Vol: <strong>{peso(totalVol)}</strong> · Fees: <strong style={{color:C.green}}>{peso(totalFees)}</strong>
        </div>
      </Card>

      {filtered.length===0&&<div style={{textAlign:"center",color:C.muted,marginTop:40,fontSize:15}}>No transactions found.</div>}
      {filtered.map(t=>{
        const s=SERVICE_TYPES[t.type]||{};
        const outletName=outlets.find(o=>o.id===t.outlet)?.name||"—";
        const staffName=accounts.find(a=>a.id===t.accountId)?.name||"—";
        return(
          <Card key={t.id} style={{marginBottom:10,display:"flex",gap:14,alignItems:"flex-start"}}>
            <div style={{fontSize:28,lineHeight:1,minWidth:32}}>{s.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <Badge color={s.color} bg={s.bg}>{s.label}{t.subType?` · ${t.subType}`:""}</Badge>
                  <span style={{fontWeight:800,fontSize:15}}>{peso(t.amount)}</span>
                  {t.fee>0&&<span style={{color:C.green,fontSize:12,fontWeight:700}}>+{peso(t.fee)} fee</span>}
                </div>
                <div style={{fontSize:12,color:C.muted,whiteSpace:"nowrap"}}>{fmt(t.date)}</div>
              </div>
              <div style={{fontSize:13,color:C.muted,marginTop:5,display:"flex",flexWrap:"wrap",gap:8}}>
                {t.customerName&&<span>👤 {t.customerName}</span>}
                {t.customerPhone&&<span>📱 {t.customerPhone}</span>}
                {isAdmin&&<span>🏪 {outletName}</span>}
                <span>👷 {staffName}</span>
                {t.note&&<span>📝 {t.note}</span>}
              </div>
            </div>
          </Card>
        );
      })}

      {modal&&<TxnForm onSave={(data)=>{addTxn(data);setModal(false);}} onClose={()=>setModal(false)} outlets={outlets} accounts={accounts} currentUser={session} floats={floats} defaultOutletId={defaultOutletId}/>}
      {ledgerModal&&<LedgerEntryForm initial={ledgerInit} onSave={(data)=>{addTxn(data);setLedgerModal(false);setLedgerInit(null);}} onClose={()=>{setLedgerModal(false);setLedgerInit(null);}} outlets={visibleOutlets} currentUser={session} floats={floats} defaultOutletId={defaultOutletId}/>}
    </div>
  );
}

// ─────────────────────────────────────────────
// FLOAT TRACKER
// ─────────────────────────────────────────────
function FloatTracker({ctx}){
  const {floats,setFloat,visibleOutlets,showToast}=ctx;
  const [editId,setEditId]=useState(null);
  const [editVal,setEditVal]=useState("");

  const save=async()=>{
    try{
      await setFloat(editId,Number(editVal));
      setEditId(null);
      showToast("Float updated.");
    }catch(e){ showToast(e.message||"Could not update float.","error"); }
  };

  const total=visibleOutlets.reduce((s,o)=>s+Number(floats[o.id]||0),0);
  const LOW=5000;

  return(
    <div>
      <div style={{fontWeight:800,fontSize:20,marginBottom:4}}>Float Tracker</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Float updates automatically on every transaction. You can also edit manually when you replenish cash.</div>

      <Card style={{marginBottom:16,background:C.blueL,border:`1px solid ${C.blue}33`}}>
        <div style={{fontSize:12,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:.5}}>Total Float</div>
        <div style={{fontSize:32,fontWeight:900,color:C.blue}}>{peso(total)}</div>
      </Card>

      {visibleOutlets.map(o=>{
        const val=floats[o.id]||0;
        const low=val<LOW;
        return(
          <Card key={o.id} style={{marginBottom:12,border:low?`2px solid ${C.orange}`:`1px solid ${C.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{width:12,height:12,borderRadius:"50%",background:o.color}}/>
                  <span style={{fontWeight:800,fontSize:15}}>{o.name}</span>
                </div>
                <div style={{fontSize:12,color:C.muted,marginLeft:20}}>📍 {o.location}</div>
                {low&&<div style={{marginLeft:20,marginTop:4}}><Badge color={C.orange} bg={C.orangeL}>⚠️ Low Float – Please Replenish</Badge></div>}
              </div>
              {editId===o.id?(
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input type="number" value={editVal} onChange={e=>setEditVal(e.target.value)}
                    style={{width:130,border:`2px solid ${C.blue}`,borderRadius:8,padding:"7px 10px",fontSize:16,fontWeight:700}}/>
                  <Btn onClick={save} variant="success" small>Save</Btn>
                  <Btn onClick={()=>setEditId(null)} variant="ghost" small>✕</Btn>
                </div>
              ):(
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{fontWeight:900,fontSize:24,color:low?C.orange:C.green}}>{peso(val)}</div>
                  <Btn onClick={()=>{setEditId(o.id);setEditVal(val);}} variant="ghost" small>Edit</Btn>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// STAFF PANEL (daily report)
// ─────────────────────────────────────────────
function StaffPanel({ctx}){
  const {accounts,outlets,txns}=ctx;
  const cashiers=accounts.filter(a=>a.role==="cashier");
  const todayT=txns.filter(t=>t.date.startsWith(todayStr()));

  return(
    <div>
      <div style={{fontWeight:800,fontSize:20,marginBottom:16}}>Staff Daily Report</div>
      <Card style={{marginBottom:16,background:C.greenL}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:12}}>📋 Today – {new Date().toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
        {cashiers.map(s=>{
          const t=todayT.filter(x=>x.accountId===s.id);
          const fees=t.reduce((a,x)=>a+Number(x.fee||0),0);
          const vol=t.reduce((a,x)=>a+Number(x.amount),0);
          const outlet=outlets.find(o=>o.id===s.outlet);
          return(
            <div key={s.id} style={{padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:C.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:C.blue}}>{s.name[0]}</div>
                  <div>
                    <div style={{fontWeight:700}}>{s.name}</div>
                    <div style={{fontSize:12,color:C.muted}}>{outlet?.name||"—"} · @{s.username}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:700,color:C.green,fontSize:15}}>{peso(fees)} <span style={{fontWeight:400,fontSize:12,color:C.muted}}>fees</span></div>
                  <div style={{fontSize:12,color:C.muted}}>{t.length} txns · {peso(vol)} vol</div>
                </div>
              </div>
              {t.length>0&&(
                <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:6,marginLeft:48}}>
                  {Object.entries(SERVICE_TYPES).map(([key,sv])=>{
                    const n=t.filter(x=>x.type===key).length;
                    if(!n)return null;
                    return <Badge key={key} color={sv.color} bg={sv.bg}>{sv.icon} {sv.label}: {n}</Badge>;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// CUSTOMER LEDGER
// ─────────────────────────────────────────────
function CustomerLedger({ctx}){
  const {customers,addCustomer,deleteCustomer,visibleTxns,outlets,showToast}=ctx;
  const [modal,setModal]=useState(false);
  const [detail,setDetail]=useState(null);
  const [form,setForm]=useState({name:"",phone:"",address:"",note:""});
  const [search,setSearch]=useState("");
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));

  const submit=async()=>{
    if(!form.name){showToast("Name is required.","error");return;}
    try{
      await addCustomer(form);
      setModal(false);
      setForm({name:"",phone:"",address:"",note:""});
      showToast("Customer added.");
    }catch(e){ showToast(e.message||"Could not add customer.","error"); }
  };

  const remove=async(id)=>{
    if(!confirm("Remove customer?"))return;
    try{ await deleteCustomer(id); }catch(e){ showToast(e.message||"Could not remove customer.","error"); }
  };

  const filtered=customers.filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase())||c.phone.includes(search));
  const getTxns=(name)=>visibleTxns.filter(t=>(t.customerName||"").toLowerCase()===name.toLowerCase());

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:20}}>Customer Ledger</div>
        <Btn onClick={()=>setModal(true)}>+ Add Customer</Btn>
      </div>
      <Inp label="" value={search} onChange={setSearch} placeholder="🔍 Search name or phone…"/>

      {filtered.map(c=>{
        const txns=getTxns(c.name);
        const total=txns.reduce((s,t)=>s+Number(t.amount),0);
        const fees=txns.reduce((s,t)=>s+Number(t.fee||0),0);
        return(
          <Card key={c.id} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
              <div style={{display:"flex",gap:12}}>
                <div style={{width:44,height:44,borderRadius:"50%",background:C.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:C.blue}}>{c.name[0]}</div>
                <div>
                  <div style={{fontWeight:700}}>{c.name}</div>
                  {c.phone&&<div style={{fontSize:12,color:C.muted}}>📱 {c.phone}</div>}
                  {c.address&&<div style={{fontSize:12,color:C.muted}}>📍 {c.address}</div>}
                  {c.note&&<Badge color={C.blue} bg={C.blueL} style={{marginTop:4}}>{c.note}</Badge>}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:C.muted}}>{txns.length} transactions</div>
                <div style={{fontWeight:700,color:C.ink}}>{peso(total)} vol</div>
                <div style={{fontWeight:700,color:C.green,fontSize:13}}>{peso(fees)} fees</div>
                <div style={{display:"flex",gap:6,marginTop:6,justifyContent:"flex-end"}}>
                  <Btn onClick={()=>setDetail(c)} variant="ghost" small>History</Btn>
                  <Btn onClick={()=>remove(c.id)} variant="danger" small>✕</Btn>
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      {modal&&(
        <Modal title="Add Customer" onClose={()=>setModal(false)}>
          <Inp label="Full Name" value={form.name} onChange={v=>setF("name",v)} req/>
          <Inp label="Phone" value={form.phone} onChange={v=>setF("phone",v)} placeholder="09xxxxxxxxx"/>
          <Inp label="Address" value={form.address} onChange={v=>setF("address",v)}/>
          <Inp label="Tag (e.g. Regular, VIP, Senior)" value={form.note} onChange={v=>setF("note",v)}/>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <Btn onClick={submit} variant="success" style={{flex:1}}>Save Customer</Btn>
            <Btn onClick={()=>setModal(false)} variant="ghost">Cancel</Btn>
          </div>
        </Modal>
      )}

      {detail&&(
        <Modal title={`${detail.name} – Transaction History`} onClose={()=>setDetail(null)} wide>
          {getTxns(detail.name).length===0?(
            <div style={{textAlign:"center",color:C.muted,padding:20}}>No transactions yet.</div>
          ):getTxns(detail.name).map(t=>{
            const s=SERVICE_TYPES[t.type]||{};
            const outletName=outlets.find(o=>o.id===t.outlet)?.name||"—";
            return(
              <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`,gap:10}}>
                <div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:18}}>{s.icon}</span>
                    <Badge color={s.color} bg={s.bg}>{s.label}{t.subType?` · ${t.subType}`:""}</Badge>
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginTop:4}}>{outletName} · {fmt(t.date)}</div>
                  {t.note&&<div style={{fontSize:12,color:C.muted}}>{t.note}</div>}
                </div>
                <div style={{textAlign:"right",whiteSpace:"nowrap"}}>
                  <div style={{fontWeight:700}}>{peso(t.amount)}</div>
                  {t.fee>0&&<div style={{fontSize:12,color:C.green}}>+{peso(t.fee)} fee</div>}
                </div>
              </div>
            );
          })}
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// OUTLET MANAGER
// ─────────────────────────────────────────────
function OutletManager({ctx}){
  const {outlets,addOutlet,deleteOutlet,accounts,txns,floats,showToast}=ctx;
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({name:"",location:"",color:C.blue});

  const submit=async()=>{
    if(!form.name){showToast("Name required.","error");return;}
    try{
      await addOutlet(form);
      setModal(false);
      setForm({name:"",location:"",color:C.blue});
      showToast("Outlet added.");
    }catch(e){ showToast(e.message||"Could not add outlet.","error"); }
  };

  const remove=async(id)=>{
    if(!confirm("Remove outlet?"))return;
    try{ await deleteOutlet(id); }catch(e){ showToast(e.message||"Could not remove outlet.","error"); }
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:20}}>Outlets</div>
        <Btn onClick={()=>setModal(true)}>+ Add Outlet</Btn>
      </div>
      {outlets.map(o=>{
        const outStaff=accounts.filter(a=>a.outlet===o.id&&a.role==="cashier");
        const todayT=txns.filter(t=>t.outlet===o.id&&t.date.startsWith(todayStr()));
        const fees=todayT.reduce((s,t)=>s+Number(t.fee||0),0);
        const fl=floats[o.id]||0;
        const low=fl<5000;
        return(
          <Card key={o.id} style={{marginBottom:14,borderLeft:`4px solid ${o.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontWeight:800,fontSize:16,display:"flex",alignItems:"center",gap:8}}>
                  🏪 {o.name}
                  {getDefaultOutlet(outlets)?.id===o.id&&<Badge color={C.blue} bg={C.blueL}>★ Default</Badge>}
                </div>
                <div style={{fontSize:13,color:C.muted}}>📍 {o.location}</div>
                <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                  <Badge color={C.blue} bg={C.blueL}>👥 {outStaff.length} staff</Badge>
                  <Badge color={C.purple} bg={C.purpleL}>📦 {todayT.length} txns today</Badge>
                  <Badge color={low?C.orange:C.green} bg={low?C.orangeL:C.greenL}>💰 {peso(fl)}</Badge>
                  <Badge color={C.green} bg={C.greenL}>💵 {peso(fees)} today</Badge>
                </div>
              </div>
              <Btn onClick={()=>remove(o.id)} variant="danger" small>Remove</Btn>
            </div>
            {outStaff.length>0&&(
              <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Assigned Staff</div>
                {outStaff.map(s=>(
                  <div key={s.id} style={{fontSize:13,marginBottom:2}}>👤 {s.name} <span style={{color:C.muted}}>· @{s.username}</span></div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
      {modal&&(
        <Modal title="Add Outlet" onClose={()=>setModal(false)}>
          <Inp label="Branch Name" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="e.g. Marikina Branch" req/>
          <Inp label="Location / Address" value={form.location} onChange={v=>setForm(p=>({...p,location:v}))} placeholder="e.g. Marikina City"/>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:6}}>Branch Color</div>
            <div style={{display:"flex",gap:10}}>
              {[C.blue,C.green,C.orange,C.purple,C.teal,C.pink,C.red,"#374151"].map(col=>(
                <div key={col} onClick={()=>setForm(p=>({...p,color:col}))}
                  style={{width:28,height:28,borderRadius:"50%",background:col,cursor:"pointer",border:form.color===col?"3px solid #000":"3px solid transparent",transition:"all .15s"}}/>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={submit} variant="success" style={{flex:1}}>Save Outlet</Btn>
            <Btn onClick={()=>setModal(false)} variant="ghost">Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ACCOUNT MANAGER (admin only)
// ─────────────────────────────────────────────
function AccountManager({ctx}){
  const {accounts,saveAccount,deleteAccount,outlets,showToast}=ctx;
  const [modal,setModal]=useState(false);
  const [editAcc,setEditAcc]=useState(null);
  const [form,setForm]=useState({name:"",username:"",password:"",role:"cashier",outlet:""});
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));

  const openNew=()=>{setForm({name:"",username:"",password:"",role:"cashier",outlet:""});setEditAcc(null);setModal(true);};
  const openEdit=(a)=>{setForm({name:a.name,username:a.username,password:a.password||"",role:a.role,outlet:a.outlet||""});setEditAcc(a.id);setModal(true);};

  const submit=async()=>{
    // Password is required for new accounts; on edit, leave blank to keep the current one.
    if(!form.name||!form.username||(!editAcc&&!form.password)){showToast("Fill all required fields.","error");return;}
    const dup=accounts.find(a=>a.username===form.username&&a.id!==editAcc);
    if(dup){showToast("Username already taken.","error");return;}
    try{
      await saveAccount(editAcc,form);
      showToast(editAcc?"Account updated.":"Account created.");
      setModal(false);
    }catch(e){ showToast(e.message||"Could not save account.","error"); }
  };

  const remove=async(id)=>{
    if(id==="a0"){showToast("Cannot remove owner account.","error");return;}
    if(!confirm("Remove this account?"))return;
    try{ await deleteAccount(id); }catch(e){ showToast(e.message||"Could not remove account.","error"); }
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:20}}>Accounts & Access</div>
        <Btn onClick={openNew}>+ Add Account</Btn>
      </div>
      <Card style={{marginBottom:16,background:C.blueL,border:`1px solid ${C.blue}33`,fontSize:13,color:C.blue}}>
        🔐 Each staff member logs in with their own username and password. Cashier accounts only see their assigned outlet. Admin accounts see everything.
      </Card>
      {accounts.map(a=>{
        const outlet=outlets.find(o=>o.id===a.outlet);
        return(
          <Card key={a.id} style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <div style={{width:42,height:42,borderRadius:"50%",background:a.role==="admin"?C.ink:C.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:18,color:a.role==="admin"?"#fff":C.blue}}>
                {a.name[0]}
              </div>
              <div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontWeight:700}}>{a.name}</span>
                  <Badge color={a.role==="admin"?C.ink:C.blue} bg={a.role==="admin"?"#E5E7EB":C.blueL}>{a.role==="admin"?"Admin":"Cashier"}</Badge>
                </div>
                <div style={{fontSize:12,color:C.muted}}>@{a.username} · {outlet?.name||"All Outlets"}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>openEdit(a)} variant="ghost" small>Edit</Btn>
              {a.id!=="a0"&&<Btn onClick={()=>remove(a.id)} variant="danger" small>Remove</Btn>}
            </div>
          </Card>
        );
      })}
      {modal&&(
        <Modal title={editAcc?"Edit Account":"New Account"} onClose={()=>setModal(false)}>
          <Inp label="Full Name" value={form.name} onChange={v=>setF("name",v)} req/>
          <Inp label="Username" value={form.username} onChange={v=>setF("username",v.toLowerCase().replace(/\s/g,""))} placeholder="e.g. maria" req/>
          <Inp label="Password" value={form.password} onChange={v=>setF("password",v)} type="password" req/>
          <Sel label="Role" value={form.role} onChange={v=>setF("role",v)}
            options={[{value:"cashier",label:"Cashier (outlet only)"},{value:"admin",label:"Admin (all outlets)"}]}/>
          {form.role==="cashier"&&(
            <Sel label="Assigned Outlet" value={form.outlet} onChange={v=>setF("outlet",v)}
              options={outlets.map(o=>({value:o.id,label:o.name}))} req/>
          )}
          <div style={{background:C.orangeL,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:C.orange,fontWeight:600}}>
            ⚠️ Share the username and password privately with the staff member.
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={submit} variant="success" style={{flex:1}}>Save Account</Btn>
            <Btn onClick={()=>setModal(false)} variant="ghost">Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// LEDGER  (passbook: DATE · IN · OUT · CHARGE · running TOTAL)
// Mirrors the handwritten GCash agent notebook. Cash-in adds cash to the
// drawer (IN); every other service hands cash out (OUT). CHARGE = the fee,
// and TOTAL is the running cumulative of all charges = total "kita".
// ─────────────────────────────────────────────
function Ledger({ctx}){
  const {visibleTxns,isAdmin,visibleOutlets,defaultOutletId,outlets}=ctx;
  const [month,setMonth]=useState("all"); // "all" | "YYYY-MM"
  // Each branch has its own passbook. Owner picks a branch (default = default
  // branch) so the running total stays separate per branch; a non-owner already
  // sees only their own account, so no selector is shown for them.
  const [outlet,setOutlet]=useState(isAdmin?(defaultOutletId||visibleOutlets[0]?.id||"all"):"own");

  const num=n=>Number(n).toLocaleString("en-PH");
  const monthLabel=m=>new Date(m+"-01T00:00:00").toLocaleDateString("en-PH",{month:"long",year:"numeric"});
  const dayLabel=iso=>new Date(iso).toLocaleDateString("en-PH",{month:"numeric",day:"numeric"});

  // Scope to the chosen branch (owner). A branch's running total must be computed
  // over only that branch's transactions.
  const base = (isAdmin && outlet!=="all") ? visibleTxns.filter(t=>t.outlet===outlet) : visibleTxns;

  // Chronological order so the running TOTAL accumulates exactly like the notebook.
  const chron=[...base].sort((a,b)=>new Date(a.date)-new Date(b.date));
  let run=0;
  const rows=chron.map(t=>{
    const charge=Number(t.fee||0);
    run+=charge;
    const isIn=(SERVICE_TYPES[t.type]?.floatEffect||0)>0;
    return{ id:t.id, date:t.date, ym:t.date.slice(0,7),
      inAmt:isIn?Number(t.amount):0, outAmt:isIn?0:Number(t.amount), charge, total:run,
      type:t.type, name:t.customerName||"" };
  });

  const months=[...new Set(rows.map(r=>r.ym))].sort();

  // Monthly Kita summary with a running cumulative (the "GCASH KITA" page).
  let mrun=0;
  const monthly=months.map(m=>{
    const kita=rows.filter(r=>r.ym===m).reduce((s,r)=>s+r.charge,0);
    mrun+=kita;
    return{month:m,kita,total:mrun};
  });

  const shown = month==="all" ? rows : rows.filter(r=>r.ym===month);
  const tIn   = shown.reduce((s,r)=>s+r.inAmt,0);
  const tOut  = shown.reduce((s,r)=>s+r.outAmt,0);
  const tChg  = shown.reduce((s,r)=>s+r.charge,0);

  const th={padding:"9px 10px",textAlign:"right",fontWeight:800,fontSize:12,color:"#fff",whiteSpace:"nowrap"};
  const td={padding:"7px 10px",textAlign:"right",fontSize:13,whiteSpace:"nowrap"};

  return(
    <div>
      <div style={{fontWeight:800,fontSize:20,marginBottom:4}}>
        GCash Ledger / Passbook
        {isAdmin&&outlet!=="all"&&<span style={{fontWeight:500,color:C.muted,fontSize:15}}> · {outlets.find(o=>o.id===outlet)?.name||""}</span>}
      </div>
      <div style={{fontSize:13,color:C.muted,marginBottom:16}}>
        Running record of cash <strong>in</strong>, cash <strong>out</strong>, charges, and total kita — just like your notebook.
      </div>

      {/* ── Branch picker (owner only) — separate passbook per branch ── */}
      {isAdmin&&visibleOutlets.length>1&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {visibleOutlets.map(o=>(
            <button key={o.id} onClick={()=>setOutlet(o.id)}
              style={{padding:"6px 14px",borderRadius:99,border:`1.5px solid ${outlet===o.id?C.blue:C.border}`,
                background:outlet===o.id?C.blue:C.white,color:outlet===o.id?"#fff":C.muted,fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
              {o.name}
            </button>
          ))}
          <button onClick={()=>setOutlet("all")}
            style={{padding:"6px 14px",borderRadius:99,border:`1.5px solid ${outlet==="all"?C.ink:C.border}`,
              background:outlet==="all"?C.ink:C.white,color:outlet==="all"?"#fff":C.muted,fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
            All branches (combined)
          </button>
        </div>
      )}

      {/* ── Monthly Kita summary (GCASH KITA) ── */}
      {monthly.length>0&&(
        <Card style={{marginBottom:16}}>
          <div style={{fontWeight:800,marginBottom:12,fontSize:15}}>📒 GCash Kita — Monthly</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:C.green}}>
                  <th style={{...th,textAlign:"left"}}>Month</th>
                  <th style={th}>Kita</th>
                  <th style={th}>Running Total</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m,i)=>(
                  <tr key={m.month} style={{background:i%2===0?C.bg:C.white}}>
                    <td style={{...td,textAlign:"left",fontWeight:700}}>{monthLabel(m.month)}</td>
                    <td style={{...td,color:C.green,fontWeight:700}}>{peso(m.kita)}</td>
                    <td style={{...td,fontWeight:800}}>{peso(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Month filter ── */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {["all",...months].map(m=>(
          <button key={m} onClick={()=>setMonth(m)}
            style={{padding:"6px 14px",borderRadius:99,border:`1.5px solid ${month===m?C.blue:C.border}`,
              background:month===m?C.blue:C.white,color:month===m?"#fff":C.muted,fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
            {m==="all"?"All":monthLabel(m)}
          </button>
        ))}
      </div>

      {/* ── Passbook table ── */}
      <Card style={{overflowX:"auto",padding:0}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:C.ink}}>
              <th style={{...th,textAlign:"left"}}>Date</th>
              <th style={th}>In</th>
              <th style={th}>Out</th>
              <th style={th}>Charge</th>
              <th style={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {shown.length===0&&(
              <tr><td colSpan={5} style={{padding:"28px 10px",textAlign:"center",color:C.muted}}>No entries yet.</td></tr>
            )}
            {shown.map((r,i)=>{
              const prev=shown[i-1];
              const newDay=!prev||prev.date.slice(0,10)!==r.date.slice(0,10);
              return(
                <tr key={r.id} style={{background:i%2===0?C.bg:C.white,borderTop:newDay?`2px solid ${C.border}`:"none"}}>
                  <td style={{...td,textAlign:"left",fontWeight:700,color:newDay?C.ink:"transparent"}}>{newDay?dayLabel(r.date):"·"}</td>
                  <td style={{...td,color:C.green,fontWeight:r.inAmt?700:400}}>{r.inAmt?num(r.inAmt):"—"}</td>
                  <td style={{...td,color:C.orange,fontWeight:r.outAmt?700:400}}>{r.outAmt?num(r.outAmt):"—"}</td>
                  <td style={{...td,color:C.blue,fontWeight:600}}>{r.charge?num(r.charge):"—"}</td>
                  <td style={{...td,fontWeight:800}}>{num(r.total)}</td>
                </tr>
              );
            })}
          </tbody>
          {shown.length>0&&(
            <tfoot>
              <tr style={{background:C.blueL,borderTop:`2px solid ${C.blue}`}}>
                <td style={{...td,textAlign:"left",fontWeight:800,color:C.blue}}>
                  {month==="all"?"All months":monthLabel(month)}
                </td>
                <td style={{...td,fontWeight:800,color:C.green}}>{num(tIn)}</td>
                <td style={{...td,fontWeight:800,color:C.orange}}>{num(tOut)}</td>
                <td style={{...td,fontWeight:800,color:C.blue}}>{num(tChg)}</td>
                <td style={{...td,fontWeight:900}}>{shown.length?num(shown[shown.length-1].total):0}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
      <div style={{fontSize:12,color:C.muted,marginTop:10}}>
        <strong style={{color:C.green}}>In</strong> = cash-in (cash received) · <strong style={{color:C.orange}}>Out</strong> = cash-out / padala / bills / load ·
        <strong style={{color:C.blue}}> Charge</strong> = your fee · <strong>Total</strong> = running kita.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REPORTS  (Daily Summary + Shift Closing)
// jsPDF loaded from CDN at runtime
// ─────────────────────────────────────────────
function Reports({ctx}){
  const {txns,outlets,accounts,floats,session,isAdmin,visibleOutlets,visibleTxns}=ctx;
  const [reportDate,setReportDate]=useState(todayStr());
  const [selOutlet,setSelOutlet]=useState(isAdmin?"all":(session.outlet||""));
  const [shiftStaff,setShiftStaff]=useState(session.id);
  const [loading,setLoading]=useState(false);
  const [preview,setPreview]=useState(null); // {type,data}

  const peso2=n=>"PHP "+Number(n).toFixed(2);

  // ── build report data ──────────────────────
  const buildData=(type)=>{
    const filtered=visibleTxns.filter(t=>{
      const dateOk=t.date.startsWith(reportDate);
      const outletOk=selOutlet==="all"||t.outlet===selOutlet;
      const staffOk=type==="shift"?t.accountId===shiftStaff:true;
      return dateOk&&outletOk&&staffOk;
    });

    const byService=Object.entries(SERVICE_TYPES).map(([key,s])=>{
      const rows=filtered.filter(t=>t.type===key);
      return{key,label:s.label,count:rows.length,volume:rows.reduce((a,t)=>a+Number(t.amount),0),fees:rows.reduce((a,t)=>a+Number(t.fee||0),0)};
    });

    const totalTxns=filtered.length;
    const totalVol=filtered.reduce((a,t)=>a+Number(t.amount),0);
    const totalFees=filtered.reduce((a,t)=>a+Number(t.fee||0),0);

    const outletName=selOutlet==="all"?"All Outlets":outlets.find(o=>o.id===selOutlet)?.name||selOutlet;
    const staffName=accounts.find(a=>a.id===shiftStaff)?.name||"—";
    const staffOutlet=outlets.find(o=>o.id===accounts.find(a=>a.id===shiftStaff)?.outlet)?.name||"—";

    const openFloat=type==="shift"
      ? "— (not tracked per shift)"
      : selOutlet==="all"
        ? peso2(visibleOutlets.reduce((s,o)=>s+Number(floats[o.id]||0),0))
        : peso2(floats[selOutlet]||0);

    return{type,filtered,byService,totalTxns,totalVol,totalFees,outletName,staffName,staffOutlet,reportDate,openFloat};
  };

  // ── load jsPDF then generate PDF ──────────
  const loadJsPDF=()=>new Promise((res,rej)=>{
    if(window.jspdf){res(window.jspdf.jsPDF);return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=()=>res(window.jspdf.jsPDF);
    s.onerror=rej;
    document.head.appendChild(s);
  });

  const generatePDF=async(type)=>{
    setLoading(true);
    try{
      const JsPDF=await loadJsPDF();
      const d=buildData(type);
      const doc=new JsPDF({unit:"mm",format:"a4"});
      const W=210; const M=18; const cW=W-M*2;
      let y=M;

      const ln=(h=6)=>{y+=h;};
      const line=(x1,y1,x2,y2,clr="#cccccc")=>{doc.setDrawColor(clr);doc.line(x1,y1,x2,y2);};
      const hline=(yy,clr)=>line(M,yy,W-M,yy,clr);
      const txt=(t,x,yy,opts={})=>{
        doc.setFontSize(opts.size||11);
        doc.setFont("helvetica",opts.bold?"bold":opts.italic?"italic":"normal");
        doc.setTextColor(opts.color||"#1A1A2E");
        doc.text(String(t),x,yy,{align:opts.align||"left",...(opts.maxW?{maxWidth:opts.maxW}:{})});
      };

      // ── Header bar ──
      doc.setFillColor(0,112,186);
      doc.rect(0,0,W,28,"F");
      doc.setFillColor(0,168,89);
      doc.rect(0,24,W,4,"F");
      txt("GCash Business Manager",M,10,{bold:true,size:16,color:"#ffffff"});
      txt(type==="daily"?"DAILY SALES SUMMARY":"SHIFT CLOSING REPORT",M,18,{size:10,color:"#cce5f8"});
      txt(new Date().toLocaleString("en-PH"),W-M,18,{size:9,color:"#cce5f8",align:"right"});
      y=36;

      // ── Report meta box ──
      doc.setFillColor(240,244,250);
      doc.roundedRect(M,y,cW,type==="shift"?28:22,3,3,"F");
      const col2=M+cW/2+4;
      txt("Report Date:",M+4,y+8,{bold:true,size:9,color:"#6B7280"});
      txt(new Date(reportDate+"T00:00:00").toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),M+36,y+8,{size:9});
      txt("Outlet:",M+4,y+16,{bold:true,size:9,color:"#6B7280"});
      txt(d.outletName,M+36,y+16,{size:9});
      if(type==="shift"){
        txt("Staff:",M+4,y+24,{bold:true,size:9,color:"#6B7280"});
        txt(`${d.staffName}  (${d.staffOutlet})`,M+36,y+24,{size:9});
        txt("Current Float:",col2,y+8,{bold:true,size:9,color:"#6B7280"});
        txt(d.openFloat,col2+30,y+8,{size:9});
      } else {
        txt("Current Float:",col2,y+8,{bold:true,size:9,color:"#6B7280"});
        txt(d.openFloat,col2+30,y+8,{size:9});
        txt("Generated by:",col2,y+16,{bold:true,size:9,color:"#6B7280"});
        txt(accounts.find(a=>a.id===session.id)?.name||"—",col2+30,y+16,{size:9});
      }
      y+=type==="shift"?34:28;

      // ── Summary totals ──
      txt("SUMMARY",M,y,{bold:true,size:10,color:"#0070BA"});
      hline(y+2,"#0070BA");
      y+=8;
      const boxes=[
        {label:"Total Transactions",val:String(d.totalTxns),color:"#0070BA"},
        {label:"Total Volume",val:peso2(d.totalVol),color:"#7C3AED"},
        {label:"Total Fees Earned",val:peso2(d.totalFees),color:"#00A859"},
      ];
      const bW=(cW-8)/3;
      boxes.forEach((b,i)=>{
        const bx=M+i*(bW+4);
        doc.setFillColor(b.color);
        doc.roundedRect(bx,y,bW,20,2,2,"F");
        doc.setFillColor(255,255,255); doc.setGState(new doc.GState({opacity:0.15}));
        doc.roundedRect(bx,y,bW,20,2,2,"F");
        doc.setGState(new doc.GState({opacity:1}));
        txt(b.val,bx+bW/2,y+11,{bold:true,size:12,color:"#ffffff",align:"center"});
        txt(b.label,bx+bW/2,y+18,{size:7,color:"#ffffff",align:"center"});
      });
      y+=28;

      // ── Breakdown by service ──
      txt("BREAKDOWN BY SERVICE",M,y,{bold:true,size:10,color:"#0070BA"});
      hline(y+2,"#0070BA");
      y+=8;
      // Table header
      doc.setFillColor(26,26,46);
      doc.rect(M,y,cW,8,"F");
      const cols=[M+2,M+50,M+90,M+130,M+162];
      ["Service","Transactions","Volume (PHP)","Fees (PHP)","% of Fees"].forEach((h,i)=>{
        txt(h,cols[i],y+5.5,{bold:true,size:8,color:"#ffffff"});
      });
      y+=8;
      const totalFeesAll=d.totalFees||1;
      d.byService.forEach((row,i)=>{
        doc.setFillColor(i%2===0?248:255,i%2===0?250:255,i%2===0?252:255);
        doc.rect(M,y,cW,7,"F");
        txt(row.label,cols[0],y+5,{size:8});
        txt(String(row.count),cols[1],y+5,{size:8});
        txt(row.volume.toFixed(2),cols[2],y+5,{size:8});
        txt(row.fees.toFixed(2),cols[3],y+5,{size:8,color:row.fees>0?"#00A859":"#6B7280",bold:row.fees>0});
        txt(((row.fees/totalFeesAll)*100).toFixed(1)+"%",cols[4],y+5,{size:8});
        y+=7;
      });
      hline(y,"#E5E7EB");
      // Totals row
      y+=2;
      doc.setFillColor(0,112,186);
      doc.rect(M,y,cW,8,"F");
      txt("TOTAL",cols[0],y+5.5,{bold:true,size:8,color:"#ffffff"});
      txt(String(d.totalTxns),cols[1],y+5.5,{bold:true,size:8,color:"#ffffff"});
      txt(d.totalVol.toFixed(2),cols[2],y+5.5,{bold:true,size:8,color:"#ffffff"});
      txt(d.totalFees.toFixed(2),cols[3],y+5.5,{bold:true,size:8,color:"#ffffff"});
      txt("100%",cols[4],y+5.5,{bold:true,size:8,color:"#ffffff"});
      y+=14;

      // ── Transaction log (last 30) ──
      if(d.filtered.length>0){
        txt("TRANSACTION LOG"+(d.filtered.length>30?" (latest 30)":""),M,y,{bold:true,size:10,color:"#0070BA"});
        hline(y+2,"#0070BA");
        y+=8;
        // check page space
        const addPage=()=>{doc.addPage();y=M;};
        // header
        doc.setFillColor(26,26,46);
        doc.rect(M,y,cW,7,"F");
        const tCols=[M+2,M+28,M+58,M+98,M+128,M+158];
        ["Time","Service","Customer","Amount","Fee","Note/Sub"].forEach((h,i)=>{
          txt(h,tCols[i],y+5,{bold:true,size:7,color:"#ffffff"});
        });
        y+=7;
        const rows=d.filtered.slice(0,30);
        rows.forEach((t,i)=>{
          if(y>270)addPage();
          doc.setFillColor(i%2===0?248:255,i%2===0?250:255,i%2===0?252:255);
          doc.rect(M,y,cW,6.5,"F");
          const time=new Date(t.date).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"});
          txt(time,tCols[0],y+4.5,{size:7});
          txt(SERVICE_TYPES[t.type]?.label||t.type,tCols[1],y+4.5,{size:7});
          txt((t.customerName||"—").slice(0,18),tCols[2],y+4.5,{size:7});
          txt(Number(t.amount).toFixed(2),tCols[3],y+4.5,{size:7});
          txt(Number(t.fee||0).toFixed(2),tCols[4],y+4.5,{size:7,color:"#00A859"});
          txt((t.subType||t.note||"").slice(0,16),tCols[5],y+4.5,{size:7,color:"#6B7280"});
          y+=6.5;
        });
      }

      // ── Shift closing signature block ──
      if(type==="shift"){
        if(y>230)doc.addPage(),y=M;
        y+=10;
        hline(y,"#E5E7EB"); y+=10;
        txt("SHIFT CLOSING ACKNOWLEDGEMENT",M,y,{bold:true,size:10,color:"#1A1A2E"}); y+=10;
        const sigBoxes=[
          {label:"Prepared by (Cashier)",name:d.staffName},
          {label:"Verified by (Supervisor)"},
          {label:"Received by (Owner)"},
        ];
        const sW=(cW-16)/3;
        sigBoxes.forEach((b,i)=>{
          const bx=M+i*(sW+8);
          hline(y+18,"#1A1A2E");
          txt(b.label,bx,y+22,{size:8,color:"#6B7280"});
          if(b.name)txt(b.name,bx,y+28,{size:8,bold:true});
        });
        y+=36;
        txt("Cash count at end of shift: PHP _______________",M,y,{size:9}); y+=10;
        txt("Discrepancy (if any): PHP _______________   Remarks: _______________________________________",M,y,{size:9});
      }

      // ── Footer ──
      const pages=doc.getNumberOfPages();
      for(let p=1;p<=pages;p++){
        doc.setPage(p);
        doc.setFillColor(0,112,186);
        doc.rect(0,287,W,10,"F");
        txt("GCash Business Manager – Confidential",M,293,{size:7,color:"#cce5f8"});
        txt(`Page ${p} of ${pages}`,W-M,293,{size:7,color:"#cce5f8",align:"right"});
      }

      const filename=type==="daily"
        ?`daily-report-${reportDate}.pdf`
        :`shift-closing-${reportDate}-${d.staffName.replace(/\s/g,"-")}.pdf`;
      doc.save(filename);
    }catch(e){
      alert("Could not generate PDF: "+e.message);
    }finally{setLoading(false);}
  };

  // ── Preview data builder ──
  const showPreview=(type)=>setPreview(buildData(type));

  const cashierList=accounts.filter(a=>a.role==="cashier"&&(isAdmin||a.outlet===session.outlet));

  return(
    <div>
      <div style={{fontWeight:800,fontSize:20,marginBottom:4}}>Reports</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Generate and download PDF reports for daily reconciliation and shift closing.</div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>

        {/* ── Daily Sales Summary ── */}
        <Card style={{border:`2px solid ${C.blue}22`}}>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:12,background:C.blueL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>📊</div>
            <div>
              <div style={{fontWeight:800,fontSize:15}}>Daily Sales Summary</div>
              <div style={{fontSize:12,color:C.muted}}>All services · All/one outlet</div>
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4}}>Report Date</div>
            <input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)}
              style={{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:14,background:C.bg,boxSizing:"border-box"}}/>
          </div>

          {isAdmin&&(
            <Sel label="Outlet" value={selOutlet} onChange={setSelOutlet}
              options={[{value:"all",label:"All Outlets"},...visibleOutlets.map(o=>({value:o.id,label:o.name}))]}/>
          )}

          <div style={{display:"flex",gap:8,marginTop:8}}>
            <Btn onClick={()=>showPreview("daily")} variant="ghost" style={{flex:1}}>Preview</Btn>
            <Btn onClick={()=>generatePDF("daily")} variant="primary" style={{flex:1}} disabled={loading}>
              {loading?"Generating…":"⬇ Download PDF"}
            </Btn>
          </div>
        </Card>

        {/* ── Shift Closing Report ── */}
        <Card style={{border:`2px solid ${C.green}22`}}>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:12,background:C.greenL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🔒</div>
            <div>
              <div style={{fontWeight:800,fontSize:15}}>Shift Closing Report</div>
              <div style={{fontSize:12,color:C.muted}}>Per staff · Includes signature block</div>
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:4}}>Shift Date</div>
            <input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)}
              style={{width:"100%",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:14,background:C.bg,boxSizing:"border-box"}}/>
          </div>

          <Sel label="Staff Member" value={shiftStaff} onChange={setShiftStaff}
            options={cashierList.map(a=>({value:a.id,label:`${a.name} – ${outlets.find(o=>o.id===a.outlet)?.name||"?"}`}))}/>

          <div style={{display:"flex",gap:8,marginTop:8}}>
            <Btn onClick={()=>showPreview("shift")} variant="ghost" style={{flex:1}}>Preview</Btn>
            <Btn onClick={()=>generatePDF("shift")} variant="success" style={{flex:1}} disabled={loading}>
              {loading?"Generating…":"⬇ Download PDF"}
            </Btn>
          </div>
        </Card>
      </div>

      {/* ── In-app preview ── */}
      {preview&&(
        <div style={{marginTop:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:16}}>
              {preview.type==="daily"?"Daily Sales Summary Preview":"Shift Closing Preview"}
            </div>
            <Btn onClick={()=>setPreview(null)} variant="ghost" small>Close Preview</Btn>
          </div>

          {/* Meta */}
          <Card style={{marginBottom:12,background:C.blueL}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8,fontSize:13}}>
              <div><span style={{color:C.muted,fontWeight:600}}>Date: </span>{new Date(preview.reportDate+"T00:00:00").toLocaleDateString("en-PH",{weekday:"short",year:"numeric",month:"short",day:"numeric"})}</div>
              <div><span style={{color:C.muted,fontWeight:600}}>Outlet: </span>{preview.outletName}</div>
              {preview.type==="shift"&&<div><span style={{color:C.muted,fontWeight:600}}>Staff: </span>{preview.staffName}</div>}
              <div><span style={{color:C.muted,fontWeight:600}}>Float: </span>{preview.openFloat}</div>
            </div>
          </Card>

          {/* Totals */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
            <Card style={{textAlign:"center",background:C.blueL}}>
              <div style={{fontSize:22,fontWeight:900,color:C.blue}}>{preview.totalTxns}</div>
              <div style={{fontSize:11,color:C.muted,fontWeight:600}}>TRANSACTIONS</div>
            </Card>
            <Card style={{textAlign:"center",background:C.purpleL}}>
              <div style={{fontSize:18,fontWeight:900,color:C.purple}}>{peso(preview.totalVol)}</div>
              <div style={{fontSize:11,color:C.muted,fontWeight:600}}>VOLUME</div>
            </Card>
            <Card style={{textAlign:"center",background:C.greenL}}>
              <div style={{fontSize:18,fontWeight:900,color:C.green}}>{peso(preview.totalFees)}</div>
              <div style={{fontSize:11,color:C.muted,fontWeight:600}}>FEES EARNED</div>
            </Card>
          </div>

          {/* Service breakdown table */}
          <Card style={{marginBottom:12,overflowX:"auto"}}>
            <div style={{fontWeight:700,marginBottom:10}}>Breakdown by Service</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:C.ink,color:"#fff"}}>
                  {["Service","Txns","Volume","Fees","% Fees"].map(h=>(
                    <th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:700,fontSize:12}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.byService.map((row,i)=>(
                  <tr key={row.key} style={{background:i%2===0?C.bg:C.white}}>
                    <td style={{padding:"7px 10px"}}>{SERVICE_TYPES[row.key]?.icon} {row.label}</td>
                    <td style={{padding:"7px 10px"}}>{row.count}</td>
                    <td style={{padding:"7px 10px"}}>{peso(row.volume)}</td>
                    <td style={{padding:"7px 10px",color:row.fees>0?C.green:C.muted,fontWeight:row.fees>0?700:400}}>{peso(row.fees)}</td>
                    <td style={{padding:"7px 10px",color:C.muted}}>{((row.fees/(preview.totalFees||1))*100).toFixed(1)}%</td>
                  </tr>
                ))}
                <tr style={{background:C.blue}}>
                  {["TOTAL",preview.totalTxns,peso(preview.totalVol),peso(preview.totalFees),"100%"].map((v,i)=>(
                    <td key={i} style={{padding:"8px 10px",color:"#fff",fontWeight:800,fontSize:13}}>{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Transaction log preview (latest 10) */}
          {preview.filtered.length>0&&(
            <Card style={{overflowX:"auto"}}>
              <div style={{fontWeight:700,marginBottom:10}}>Transaction Log {preview.filtered.length>10&&`(showing 10 of ${preview.filtered.length})`}</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:C.ink,color:"#fff"}}>
                    {["Time","Service","Customer","Amount","Fee","Note"].map(h=>(
                      <th key={h} style={{padding:"7px 8px",textAlign:"left",fontWeight:700}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.filtered.slice(0,10).map((t,i)=>{
                    const s=SERVICE_TYPES[t.type]||{};
                    return(
                      <tr key={t.id} style={{background:i%2===0?C.bg:C.white}}>
                        <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>{new Date(t.date).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}</td>
                        <td style={{padding:"6px 8px"}}><Badge color={s.color} bg={s.bg}>{s.label}</Badge></td>
                        <td style={{padding:"6px 8px"}}>{t.customerName||"—"}</td>
                        <td style={{padding:"6px 8px",fontWeight:700}}>{peso(t.amount)}</td>
                        <td style={{padding:"6px 8px",color:C.green,fontWeight:600}}>{t.fee>0?peso(t.fee):"—"}</td>
                        <td style={{padding:"6px 8px",color:C.muted}}>{t.subType||t.note||"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {preview.filtered.length===0&&(
            <Card style={{textAlign:"center",color:C.muted,padding:32}}>
              No transactions found for this period / staff.
            </Card>
          )}

          <div style={{marginTop:14,display:"flex",gap:10}}>
            <Btn onClick={()=>generatePDF(preview.type)} style={{flex:1}} disabled={loading}>
              {loading?"Generating…":`⬇ Download ${preview.type==="daily"?"Daily Summary":"Shift Closing"} PDF`}
            </Btn>
            <Btn onClick={()=>setPreview(null)} variant="ghost">Close</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
