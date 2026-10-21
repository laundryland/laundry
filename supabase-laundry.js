(function(){
if(window.__laundry_supabase_loaded) return; window.__laundry_supabase_loaded=true;

var SUPABASE_URL="https://zfyjcaklaithzykkdrne.supabase.co";
var SUPABASE_KEY="sb_publishable_xnLqevbuQVG_U6XDATKSHw_nBBZs161";
var supabaseClient=null, realtimeChannel=null;
var DB_KEY="laundryland_db_v2"; // sama dengan DB_KEY di index.html

function log(m){console.log("[Laundry Supa]",m);}

function getDB(){ try{ return JSON.parse(localStorage.getItem(DB_KEY)||localStorage.getItem("laundryland_db")||"null")||{outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[]}; }catch{ return {outlets:[],karyawans:[],pelanggans:[],notas:[]}; } }
function saveDBLocal(db){ try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){} }

function initSupabase(){
  try{
    if(window.supabase && window.supabase.createClient){
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      log("Connected "+SUPABASE_URL);
      try{
        realtimeChannel = supabaseClient.channel("laundry-sync")
          .on("postgres_changes",{event:"*",schema:"public",table:"laundry_backup"}, function(payload){
            log("Update dari HP lain -> reload");
            setTimeout(()=>loadFromSupabase(true),800);
          }).subscribe();
      }catch(e){ log("Realtime fail "+e.message); }
      return true;
    }
  }catch(e){ log("Init fail "+e.message); }
  return false;
}

async function syncToSupabase(){
  if(!supabaseClient && !initSupabase()) return {ok:false, reason:"no client"};
  try{
    var db = getDB();
    if(!db.outlets || db.outlets.length===0) return {ok:true, empty:true};

    // Pola WA parser: 1 baris per outlet, semua data di JSONB
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
      log("Sync OK outlet "+outletId+" "+outletNotas.length+" nota");
    }
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

    // Merge: kalau data supabase lebih baru, timpa lokal
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

    // Kalau ada data baru dari supabase
    if(merged.notas.length > (localDB.notas||[]).length || merged.pelanggans.length > (localDB.pelanggans||[]).length){
      saveDBLocal(merged);
      log("Load "+merged.notas.length+" nota dari Supabase, reload UI");
      if(!silent){
        if(typeof renderAll==='function') renderAll();
        window.dispatchEvent(new Event("storage"));
      } else {
        // silent reload tetap update badge
        if(typeof renderAntrian==='function') setTimeout(()=>{ try{renderAntrian();}catch(e){} },500);
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
    setTimeout(()=>loadFromSupabase(true),1000);
    setTimeout(()=>syncToSupabase(),2500);
  } else if(retry++>15){ clearInterval(t); }
},1000);

setInterval(()=>{ if(document.visibilityState==="visible") syncToSupabase(); },30000);
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") loadFromSupabase(true); });
window.addEventListener("laundry-updated", ()=>{ setTimeout(()=>syncToSupabase(),600); });

})();
