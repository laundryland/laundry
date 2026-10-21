(function(){
if(window.__laundry_supabase_loaded) return; window.__laundry_supabase_loaded=true;
var SUPABASE_URL="https://zfyjcaklaithzykkdrne.supabase.co";
var SUPABASE_KEY="sb_publishable_xnLqevbuQVG_U6XDATKSHw_nBBZs161";
var supabaseClient=null;
var DB_KEY="laundryland_db_v2";
var lastHash="";
function log(m){console.log("[Supa v30 - GitHub & Pages Terhubung]",m);}
function getDB(){ try{ return JSON.parse(localStorage.getItem(DB_KEY)||"null")||{outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[]}; }catch{ return {outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[]}; } }
function saveDBLocal(db){ try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){} }
function hashDB(db){ try{ return (db.notas||[]).length+":"+(db.pelanggans||[]).length; }catch(e){ return Date.now()+""; } }
function initSupabase(){
  try{
    if(window.supabase && window.supabase.createClient){
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      log("Connected - GitHub & Pages terhubung via Supabase");
      return true;
    }
  }catch(e){}
  return false;
}
async function syncToSupabase(){
  if(!supabaseClient && !initSupabase()) return;
  try{
    var db=getDB();
    if(!db.outlets || !db.outlets.length) return;
    var isEmpty = (db.notas||[]).length===0 && (db.pelanggans||[]).length===0 && (db.layanans||[]).length<=2;
    if(isEmpty){ log("Skip sync, local kosong, biar gak timpa 0"); return; }
    try{ var seen={}; db.outlets=db.outlets.filter(o=>{ if(seen[o.id]) return false; seen[o.id]=1; return true; }); }catch(e){}
    var h=hashDB(db);
    if(h===lastHash) return;
    for(var outlet of db.outlets){
      var payload={ outlet_id:outlet.id, outlet_nama:outlet.nama, data:{ outlet:outlet, karyawans:db.karyawans, pelanggans:db.pelanggans, layanans:db.layanans, notas:db.notas, pengeluarans:db.pengeluarans }, total_nota:(db.notas||[]).length, total_pelanggan:(db.pelanggans||[]).length, updated_at:new Date().toISOString() };
      await supabaseClient.from("laundry_backup").upsert(payload,{onConflict:"outlet_id"});
    }
    lastHash=h;
    log("Sync OK "+(db.notas||[]).length+" nota - GitHub & Pages terhubung");
  }catch(e){ log("fail "+e.message); }
}
async function loadFromSupabase(force){
  if(!supabaseClient && !initSupabase()) return;
  try{
    var localDB=getDB();
    var isLocalEmpty = (localDB.notas||[]).length===0 && (localDB.pelanggans||[]).length===0;
    if(!isLocalEmpty && !force){ log("Local ada data, skip auto load"); return; }
    var res=await supabaseClient.from("laundry_backup").select("*").order("updated_at",{ascending:false}).limit(10);
    if(!res.data || !res.data.length){ log("Supabase kosong"); return; }
    var merged={outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[],setting:localDB.setting};
    var seenN={}, seenP={}, seenL={}, seenK={}, seenO={};
    for(var row of res.data){
      var d=row.data||{};
      if(d.outlet && !seenO[d.outlet.id]){ merged.outlets.push(d.outlet); seenO[d.outlet.id]=1; }
      for(var k of (d.karyawans||[])) if(!seenK[k.id]){ merged.karyawans.push(k); seenK[k.id]=1; }
      for(var p of (d.pelanggans||[])) if(!seenP[p.id]){ merged.pelanggans.push(p); seenP[p.id]=1; }
      for(var l of (d.layanans||[])) if(!seenL[l.id]){ merged.layanans.push(l); seenL[l.id]=1; }
      for(var n of (d.notas||[])) if(!seenN[n.id]){ merged.notas.push(n); seenN[n.id]=1; }
    }
    var seenO2={}; merged.outlets=merged.outlets.filter(o=>{ if(seenO2[o.id]) return false; seenO2[o.id]=1; return true; });
    if(!merged.karyawans.length) merged.karyawans=[{id:'karyawan_1',nama:'Owner',pin:'123456',level:'Owner',outlet_id:'outlet_1',lintas:true},{id:'karyawan_2',nama:'Admin',pin:'000000',level:'Admin',outlet_id:'outlet_1',lintas:true}];
    if(!merged.outlets.length) merged.outlets=[{id:'outlet_1',nama:'LaundryLand Pusat - Madiun',alamat:'Jl. Contoh No.1 Madiun',aktif:true}];
    if(!merged.layanans.length) merged.layanans=[{id:'lay_1',kode:'CKS01',nama:'Cuci Kering Setrika',harga:7000,satuan:'Kg',min_qty:3},{id:'lay_2',kode:'SPS01',nama:'Setrika Saja',harga:4000,satuan:'Kg',min_qty:1}];
    if(merged.notas.length>0 || merged.pelanggans.length>0 || isLocalEmpty){
      merged.outlets.forEach((o,i)=>o.aktif=i===0);
      saveDBLocal(merged);
      lastHash=hashDB(merged);
      log("RESTORE "+merged.notas.length+" nota dari Supabase - GitHub & Pages terhubung");
      if(typeof renderAll==='function') setTimeout(()=>{ try{renderAll();}catch(e){} },800);
    }
  }catch(e){ log("load fail "+e.message); }
}
window.LaundrySupabase={init:initSupabase, sync:syncToSupabase, load:loadFromSupabase, manualRestore:function(){ loadFromSupabase(true); alert('Restore dari Cloud selesai'); if(typeof renderAll==='function') renderAll(); }};
var t=setInterval(function(){ if(initSupabase()){ clearInterval(t); setTimeout(()=>loadFromSupabase(false),1500); } },1000);
window.addEventListener("laundry-updated", ()=>{ setTimeout(()=>syncToSupabase(),1000); });
})();
