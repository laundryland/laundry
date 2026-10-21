(function(){
if(window.__laundry_supabase_loaded) return; window.__laundry_supabase_loaded=true;
var SUPABASE_URL="https://zfyjcaklaithzykkdrne.supabase.co";
var SUPABASE_KEY="sb_publishable_xnLqevbuQVG_U6XDATKSHw_nBBZs161";
var supabaseClient=null, realtimeChannel=null;
var DB_KEY="laundryland_db_v2";
var ignoreUntil=0;
var lastHash="";
function log(m){console.log("[Supa v23]",m);}
function getDB(){ try{ return JSON.parse(localStorage.getItem(DB_KEY)||"null")||{outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[]}; }catch{ return {outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[]}; } }
function saveDBLocal(db){ try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){} }
function hashDB(db){ try{ return (db.notas||[]).length+":"+(db.pelanggans||[]).length+":"+(db.layanans||[]).length+":"+(db.karyawans||[]).length; }catch(e){ return Date.now()+""; } }
function initSupabase(){
  try{
    if(window.supabase && window.supabase.createClient){
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      log("Connected");
      try{
        if(realtimeChannel) try{ supabaseClient.removeChannel(realtimeChannel); }catch(e){}
        realtimeChannel = supabaseClient.channel("laundry-sync-v23")
          .on("postgres_changes",{event:"*",schema:"public",table:"laundry_backup"}, function(){
            if(Date.now()<ignoreUntil) return;
            setTimeout(()=>loadFromSupabase(true),1000);
          }).subscribe();
      }catch(e){}
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
    var h=hashDB(db);
    if(h===lastHash) return;
    var empty = (db.notas||[]).length===0 && (db.pelanggans||[]).length===0 && (db.layanans||[]).length<=2;
    var noKar = !db.karyawans || !db.karyawans.length;
    if(empty || noKar){
      log("Local kosong, cek Supabase dulu jangan timpa");
      var chk=await supabaseClient.from("laundry_backup").select("total_nota,total_pelanggan").limit(5);
      if(chk.data && chk.data.some(r=> (r.total_nota||0)>0 || (r.total_pelanggan||0)>0 )){
        log("Supabase ada data, skip sync kosong, load dulu");
        await loadFromSupabase(true);
        return;
      }
    }
    ignoreUntil=Date.now()+4000;
    // FIX v24: dedup outlets before sync
      try{
        const seenO={}; db.outlets = db.outlets.filter(o=>{ if(seenO[o.id]) return false; seenO[o.id]=1; return true; });
      }catch(e){}
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
    log("Sync OK "+(db.notas||[]).length+" nota / "+(db.layanans||[]).length+" layanan");
  }catch(e){ log("sync fail "+e.message); }
}
async function loadFromSupabase(silent){
  if(!supabaseClient && !initSupabase()) return;
  try{
    var localDB=getDB();
    var res=await supabaseClient.from("laundry_backup").select("*").order("updated_at",{ascending:false}).limit(10);
    if(!res.data || !res.data.length) return;
    var merged={outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[],setting:localDB.setting};
    var seen={};
    for(var row of res.data){
      var d=row.data||{};
      if(d.outlet && !merged.outlets.find(o=>o.id===d.outlet.id)) merged.outlets.push(d.outlet);
      for(var k of (d.karyawans||[])) if(!merged.karyawans.find(x=>x.id===k.id)) merged.karyawans.push(k);
      for(var p of (d.pelanggans||[])) if(!merged.pelanggans.find(x=>x.id===p.id)) merged.pelanggans.push(p);
      for(var l of (d.layanans||[])) if(!merged.layanans.find(x=>x.id===l.id)) merged.layanans.push(l);
      for(var n of (d.notas||[])) if(!merged.notas.find(x=>x.id===n.id)) merged.notas.push(n);
      for(var pe of (d.pengeluarans||[])) if(!merged.pengeluarans.find(x=>x.id===pe.id)) merged.pengeluarans.push(pe);
    }
    // Jika remote ada layanan tapi local kosong -> restore
    var need = merged.notas.length>(localDB.notas||[]).length || merged.pelanggans.length>(localDB.pelanggans||[]).length || merged.layanans.length>(localDB.layanans||[]).length || merged.karyawans.length>(localDB.karyawans||[]).length;
    var localEmpty = (localDB.notas||[]).length===0 && (localDB.layanans||[]).length<=2;
    if(need || (localEmpty && (merged.notas.length>0 || merged.layanans.length>2))){
      // jangan timpa setting kosong dengan kosong
      merged.setting = localDB.setting || merged.setting;
      if(!merged.karyawans.length){
        merged.karyawans=[{id:'karyawan_1',nama:'Owner',pin:'123456',level:'Owner',outlet_id:'outlet_1',lintas:true},{id:'karyawan_2',nama:'Admin',pin:'000000',level:'Admin',outlet_id:'outlet_1',lintas:true}];
      }
      if(!merged.outlets.length){
        merged.outlets=[{id:'outlet_1',nama:'LaundryLand Pusat - Madiun',alamat:'Jl. Contoh No.1 Madiun',aktif:true}];
      }
      if(!merged.layanans.length){
        var now=Date.now();
        merged.layanans=[{id:'lay_1',kode:'CKS01',nama:'Cuci Kering Setrika',harga:7000,satuan:'Kg',min_qty:3,estimasi_jenis:'Hari',estimasi_nilai:1,last_modified:now},{id:'lay_2',kode:'SPS01',nama:'Setrika Saja',harga:4000,satuan:'Kg',min_qty:1,estimasi_jenis:'Jam',estimasi_nilai:6,last_modified:now}];
      }
      saveDBLocal(merged);
      lastHash=hashDB(merged);
      log("Restore dari Supabase: "+merged.notas.length+" nota, "+merged.layanans.length+" layanan, "+merged.karyawans.length+" karyawan");
      if(typeof renderAll==='function') setTimeout(()=>{ try{renderAll();}catch(e){} },500);
    }
  }catch(e){ log("load fail "+e.message); }
}
window.LaundrySupabase={init:initSupabase, sync:syncToSupabase, load:loadFromSupabase};
var t=setInterval(function(){ if(initSupabase()){ clearInterval(t); setTimeout(()=>loadFromSupabase(true),1000); setTimeout(()=>syncToSupabase(),3000);} },1000);
setInterval(()=>{ if(document.visibilityState==="visible") syncToSupabase(); },60000);
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") loadFromSupabase(true); });
})();
