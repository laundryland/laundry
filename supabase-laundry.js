(function(){
if(window.__laundry_supabase_loaded) return; window.__laundry_supabase_loaded=true;

var SUPABASE_URL="https://zfyjcaklaithzykkdrne.supabase.co";
var SUPABASE_KEY="sb_publishable_xnLqevbuQVG_U6XDATKSHw_nBBZs161";
var supabaseClient=null, realtimeChannel=null;
var DB_KEY="laundryland_db_v2";
var ignoreRealtimeUntil=0;
var lastSyncHash="";
var lastRemoteHash="";

function log(m){console.log("[Laundry Supa]",m);}

function getDB(){ try{ return JSON.parse(localStorage.getItem(DB_KEY)||localStorage.getItem("laundryland_db")||"null")||{outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[]}; }catch{ return {outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[]}; } }
function saveDBLocal(db){ try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){} }

function hashDB(db){
  try{
    return JSON.stringify({
      o: (db.outlets||[]).length,
      k: (db.karyawans||[]).length,
      p: (db.pelanggans||[]).length,
      l: (db.layanans||[]).length,
      n: (db.notas||[]).length,
      pe: (db.pengeluarans||[]).length
    });
  }catch(e){ return ""+Date.now(); }
}

function initSupabase(){
  try{
    if(window.supabase && window.supabase.createClient){
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      log("Connected "+SUPABASE_URL);
      try{
        if(realtimeChannel) { try{ supabaseClient.removeChannel(realtimeChannel); }catch(e){} }
        realtimeChannel = supabaseClient.channel("laundry-sync-v20")
          .on("postgres_changes",{event:"*",schema:"public",table:"laundry_backup"}, function(payload){
            if(Date.now() < ignoreRealtimeUntil){
              log("Ignore own realtime (debounce)");
              return;
            }
            log("Update dari HP lain -> load (debounced)");
            setTimeout(()=>loadFromSupabase(true),1200);
          }).subscribe((status)=>{
            log("Realtime status: "+status);
          });
      }catch(e){ log("Realtime fail "+e.message); }
      return true;
    }
  }catch(e){ log("Init fail "+e.message); }
  return false;
}

async function syncToSupabase(force){
  if(!supabaseClient && !initSupabase()) return {ok:false, reason:"no client"};
  try{
    var db = getDB();
    if(!db.outlets || db.outlets.length===0) return {ok:true, empty:true};

    var currentHash = hashDB(db);
    if(!force && currentHash === lastSyncHash){
      return {ok:true, skipped:true};
    }

    var isLocalEmpty = (db.notas||[]).length===0 && (db.pelanggans||[]).length===0 && (db.pengeluarans||[]).length===0 && (db.layanans||[]).length<=2;
    var isKaryawanEmpty = !db.karyawans || db.karyawans.length===0;
    if(isLocalEmpty || isKaryawanEmpty){
      log("Local kosong/karyawan kosong, cek remote dulu biar tidak nimpa data lama");
      var remoteCheck = await supabaseClient.from("laundry_backup").select("total_nota, total_pelanggan, outlet_id, data").limit(20);
      if(remoteCheck.data && remoteCheck.data.length>0){
        var remoteHasData = remoteCheck.data.some(r=> (r.total_nota||0)>0 || (r.total_pelanggan||0)>0 || (r.data && r.data.karyawans && r.data.karyawans.length>0) );
        if(remoteHasData){
          log("Remote ada data, SKIP sync kosong, load remote dulu");
          await loadFromSupabase(true);
          return {ok:true, skippedEmpty:true};
        }
      }
      if(isKaryawanEmpty){
        log("Karyawan kosong, restore default sebelum sync");
        var def = {outlets:[{id:'outlet_1',nama:'LaundryLand Pusat - Madiun',alamat:'Jl. Contoh No.1 Madiun',aktif:true,last_modified:Date.now()}], karyawans:[{id:'karyawan_1',nama:'Owner',pin:'123456',level:'Owner',outlet_id:'outlet_1',lintas:true,last_modified:Date.now()},{id:'karyawan_2',nama:'Admin',pin:'000000',level:'Admin',outlet_id:'outlet_1',lintas:true,last_modified:Date.now()}]};
        var cur = getDB();
        cur.karyawans = def.karyawans;
        if(!cur.outlets || cur.outlets.length===0) cur.outlets = def.outlets;
        saveDBLocal(cur);
      }
    }

    ignoreRealtimeUntil = Date.now() + 5000;

    for(var outlet of db.outlets){
      var outletId = outlet.id;
      var outletNotas = (db.notas||[]).filter(n=>!n.outlet_id || n.outlet_id===outletId);
      var outletPelanggans = (db.pelanggans||[]).filter(p=>!p.outlet_id || p.outlet_id===outletId);
      var payload = {
        outlet_id: outletId,
        outlet_nama: outlet.nama||'Outlet',
        data: {
          outlet: outlet,
          karyawans: (db.karyawans||[]).filter(k=>!k.outlet_id || k.outlet_id===outletId || k.lintas),
          pelanggans: outletPelanggans,
          layanans: db.layanans||[],
          notas: outletNotas,
          pengeluarans: (db.pengeluarans||[]).filter(pe=>!pe.outlet_id || pe.outlet_id===outletId)
        },
        total_nota: outletNotas.length,
        total_pelanggan: outletPelanggans.length,
        updated_at: new Date().toISOString()
      };
      var res = await supabaseClient.from("laundry_backup").upsert(payload, {onConflict:"outlet_id"});
      if(res.error) throw res.error;
      log("Sync OK outlet "+outletId+" "+outletNotas.length+" nota / "+outletPelanggans.length+" pelanggan / "+(db.layanans||[]).length+" layanan / "+(db.karyawans||[]).length+" karyawan");
    }
    lastSyncHash = currentHash;
    return {ok:true};
  }catch(err){
    log("Sync fail: "+err.message);
    return {ok:false, error:err.message};
  }
}

async function loadFromSupabase(silent){
  if(!supabaseClient && !initSupabase()) return {ok:false};
  try{
    var localDB = getDB();
    var res = await supabaseClient.from("laundry_backup").select("*").order("updated_at",{ascending:false}).limit(20);
    if(res.error) throw res.error;
    if(!res.data || res.data.length===0) return {ok:true, empty:true};

    var remoteHash = JSON.stringify(res.data.map(r=>r.outlet_id+":"+(r.total_nota||0)+":"+(r.total_pelanggan||0)+":"+r.updated_at).join("|"));
    if(remoteHash === lastRemoteHash && silent){
      return {ok:true, noChange:true};
    }
    lastRemoteHash = remoteHash;

    var merged = {outlets:[], karyawans:[], pelanggans:[], layanans:[], notas:[], pengeluarans:[], setting: localDB.setting};
    var seenOutlet={}, seenKaryawan={}, seenPelanggan={}, seenLayanan={}, seenNota={}, seenPengeluaran={};

    for(var row of res.data){
      var d = row.data||{};
      if(d.outlet && !seenOutlet[d.outlet.id]){ merged.outlets.push(d.outlet); seenOutlet[d.outlet.id]=1; }
      for(var k of (d.karyawans||[])){ if(!seenKaryawan[k.id]){ merged.karyawans.push(k); seenKaryawan[k.id]=1; } }
      for(var p of (d.pelanggans||[])){ if(!seenPelanggan[p.id]){ merged.pelanggans.push(p); seenPelanggan[p.id]=1; } }
      for(var l of (d.layanans||[])){ if(!seenLayanan[l.id]){ merged.layanans.push(l); seenLayanan[l.id]=1; } }
      for(var n of (d.notas||[])){ if(!seenNota[n.id||n.no_nota]){ merged.notas.push(n); seenNota[n.id||n.no_nota]=1; } }
      for(var pe of (d.pengeluarans||[])){ if(!seenPengeluaran[pe.id]){ merged.pengeluarans.push(pe); seenPengeluaran[pe.id]=1; } }
    }

    var needUpdate = false;
    if(merged.notas.length > (localDB.notas||[]).length) needUpdate=true;
    if(merged.pelanggans.length > (localDB.pelanggans||[]).length) needUpdate=true;
    if(merged.layanans.length > (localDB.layanans||[]).length) needUpdate=true;
    if(merged.karyawans.length > (localDB.karyawans||[]).length) needUpdate=true;
    if(merged.outlets.length > (localDB.outlets||[]).length) needUpdate=true;
    if(merged.pengeluarans.length > (localDB.pengeluarans||[]).length) needUpdate=true;

    var localEmpty = (localDB.notas||[]).length===0 && (localDB.pelanggans||[]).length===0 && (localDB.layanans||[]).length<=2;
    var localKaryawanEmpty = !localDB.karyawans || localDB.karyawans.length===0;
    if((localEmpty && (merged.notas.length>0 || merged.pelanggans.length>0 || merged.layanans.length>2)) || (localKaryawanEmpty && merged.karyawans.length>0)){
      needUpdate=true;
      log("Local kosong/karyawan kosong tapi remote ada data, RESTORE dari Supabase");
    }

    if(needUpdate){
      merged.setting = localDB.setting || merged.setting;
      if(!merged.karyawans || merged.karyawans.length===0){
        merged.karyawans = [{id:'karyawan_1',nama:'Owner',pin:'123456',level:'Owner',outlet_id:'outlet_1',lintas:true,last_modified:Date.now()},{id:'karyawan_2',nama:'Admin',pin:'000000',level:'Admin',outlet_id:'outlet_1',lintas:true,last_modified:Date.now()}];
      }
      if(!merged.outlets || merged.outlets.length===0){
        merged.outlets = [{id:'outlet_1',nama:'LaundryLand Pusat - Madiun',alamat:'Jl. Contoh No.1 Madiun',aktif:true,last_modified:Date.now()}];
      }
      saveDBLocal(merged);
      log("Load "+merged.notas.length+" nota, "+merged.pelanggans.length+" pelanggan, "+merged.layanans.length+" layanan, "+merged.karyawans.length+" karyawan dari Supabase -> reload UI");
      lastSyncHash = hashDB(merged);
      if(!silent){
        if(typeof renderAll==='function') renderAll();
        try{ window.dispatchEvent(new Event("storage")); }catch(e){}
      } else {
        if(typeof renderAll==='function') setTimeout(()=>{ try{renderAll();}catch(e){} },600);
        else if(typeof renderAntrian==='function') setTimeout(()=>{ try{renderAntrian();}catch(e){} },500);
      }
      return {ok:true, imported: merged.notas.length};
    }
    return {ok:true, noNew:true};
  }catch(err){
    log("Load fail: "+err.message);
    return {ok:false, error:err.message};
  }
}

window.LaundrySupabase={init:initSupabase, sync:syncToSupabase, load:loadFromSupabase};

var retry=0;
var t=setInterval(function(){
  if(initSupabase()){
    clearInterval(t);
    setTimeout(()=>loadFromSupabase(true),1500);
    setTimeout(()=>syncToSupabase(false),3500);
  } else if(retry++>15){ clearInterval(t); }
},1000);

setInterval(()=>{ if(document.visibilityState==="visible") syncToSupabase(false); },60000);
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") loadFromSupabase(true); });
window.addEventListener("laundry-updated", ()=>{ setTimeout(()=>syncToSupabase(false),800); });

})();
