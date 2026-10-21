(function(){
if(window.__laundry_supabase_loaded) return; window.__laundry_supabase_loaded=true;
var SUPABASE_URL="https://zfyjcaklaithzykkdrne.supabase.co";
var SUPABASE_KEY="sb_publishable_xnLqevbuQVG_U6XDATKSHw_nBBZs161";
var supabaseClient=null;
var DB_KEY="laundryland_db_v2";
var lastHash="";
function log(m){console.log("[Supa v25 STABLE]",m);}
function getDB(){ try{ return JSON.parse(localStorage.getItem(DB_KEY)||"null")||{outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[]}; }catch{ return {outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[]}; } }
function saveDBLocal(db){ try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){} }
function hashDB(db){ try{ return (db.notas||[]).length+":"+(db.pelanggans||[]).length+":"+(db.layanans||[]).length+":"+(db.karyawans||[]).length+":"+(db.outlets||[]).length; }catch(e){ return Date.now()+""; } }
function initSupabase(){
  try{
    if(window.supabase && window.supabase.createClient){
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      log("Connected - SAFE MODE (no auto overwrite)");
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
    // dedup outlets
    try{
      var seen={}; db.outlets=db.outlets.filter(o=>{ if(seen[o.id]) return false; seen[o.id]=1; return true; });
    }catch(e){}
    var h=hashDB(db);
    if(h===lastHash) return;
    // JANGAN sync kalau local kosong total (cegah timpa Supabase jadi 0)
    var empty = (db.notas||[]).length===0 && (db.pelanggans||[]).length===0 && (db.layanans||[]).length<=2;
    if(empty){
      log("Local kosong, SKIP sync biar Supabase gak jadi 0");
      return;
    }
    for(var outlet of db.outlets){
      var payload={
        outlet_id:outlet.id,
        outlet_nama:outlet.nama||'Outlet',
        data:{
          outlet:outlet,
          karyawans:db.karyawans||[],
          pelanggans:db.pelanggans||[],
          layanans:db.layanans||[],
          notas:db.notas||[],
          pengeluarans:db.pengeluarans||[]
        },
        total_nota:(db.notas||[]).length,
        total_pelanggan:(db.pelanggans||[]).length,
        updated_at:new Date().toISOString()
      };
      await supabaseClient.from("laundry_backup").upsert(payload,{onConflict:"outlet_id"});
    }
    lastHash=h;
    log("Sync OK "+(db.notas||[]).length+" nota");
  }catch(e){ log("sync fail "+e.message); }
}
async function loadFromSupabase(manual){
  if(!supabaseClient && !initSupabase()) return;
  try{
    var localDB=getDB();
    var res=await supabaseClient.from("laundry_backup").select("*").order("updated_at",{ascending:false}).limit(10);
    if(!res.data || !res.data.length) return;
    // Only load if user clicks manual or local is truly empty
    var isEmpty = (localDB.notas||[]).length===0 && (localDB.pelanggans||[]).length===0 && (localDB.layanans||[]).length<=2;
    if(!manual && !isEmpty) {
      log("Local ada data, skip auto load biar gak dobel");
      return;
    }
    var merged={outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[],setting:localDB.setting};
    for(var row of res.data){
      var d=row.data||{};
      if(d.outlet && !merged.outlets.find(o=>o.id===d.outlet.id)) merged.outlets.push(d.outlet);
      for(var k of (d.karyawans||[])) if(!merged.karyawans.find(x=>x.id===k.id)) merged.karyawans.push(k);
      for(var p of (d.pelanggans||[])) if(!merged.pelanggans.find(x=>x.id===p.id)) merged.pelanggans.push(p);
      for(var l of (d.layanans||[])) if(!merged.layanans.find(x=>x.id===l.id)) merged.layanans.push(l);
      for(var n of (d.notas||[])) if(!merged.notas.find(x=>x.id===n.id)) merged.notas.push(n);
    }
    // dedup outlets
    var seenO={}; merged.outlets=merged.outlets.filter(o=>{ if(seenO[o.id]) return false; seenO[o.id]=1; return true; });
    if(!merged.karyawans.length){
      merged.karyawans=[{id:'karyawan_1',nama:'Owner',pin:'123456',level:'Owner',outlet_id:'outlet_1',lintas:true},{id:'karyawan_2',nama:'Admin',pin:'000000',level:'Admin',outlet_id:'outlet_1',lintas:true}];
    }
    if(!merged.outlets.length){
      merged.outlets=[{id:'outlet_1',nama:'LaundryLand Pusat - Madiun',alamat:'Jl. Contoh No.1 Madiun',aktif:true}];
    }
    if(!merged.layanans.length){
      merged.layanans=[{id:'lay_1',kode:'CKS01',nama:'Cuci Kering Setrika',harga:7000,satuan:'Kg',min_qty:3},{id:'lay_2',kode:'SPS01',nama:'Setrika Saja',harga:4000,satuan:'Kg',min_qty:1}];
    }
    // Only restore if remote has more data
    if(merged.notas.length>(localDB.notas||[]).length || merged.pelanggans.length>(localDB.pelanggans||[]).length || isEmpty){
      saveDBLocal(merged);
      lastHash=hashDB(merged);
      log("Restore "+merged.notas.length+" nota dari Supabase");
      if(typeof renderAll==='function') setTimeout(()=>{ try{renderAll();}catch(e){} },500);
    }
  }catch(e){ log("load fail "+e.message); }
}
window.LaundrySupabase={init:initSupabase, sync:syncToSupabase, load:loadFromSupabase, manualLoad:function(){ loadFromSupabase(true); }};
// Init but NO auto sync every 30s that causes dobel - only on load once
var t=setInterval(function(){ if(initSupabase()){ clearInterval(t); setTimeout(()=>loadFromSupabase(false),2000); } },1000);
// Manual sync only when user saves data
window.addEventListener("laundry-updated", ()=>{ setTimeout(()=>syncToSupabase(),1000); });
})();
