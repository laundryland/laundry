(function(){
if(window.__supabase_loaded) return; window.__supabase_loaded=true;

var SUPABASE_URL="https://zfyjcaklaithzykkdrne.supabase.co";
var SUPABASE_ANON_KEY="sb_publishable_xnLqevbuQVG_U6XDATKSHw_nBBZs161";
var supabaseClient=null, realtimeChannel=null;
var LS_KEY="laundryland_db_v2";

function log(m){console.log("[Supabase Laundry]",m);}
function todayLocal(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function makeKeyNota(no_nota){ return String(no_nota||"").toLowerCase().trim(); }

function getDB(){
  try{
    if(window.DB && window.DB.outlets && window.DB.outlets.length>0) return window.DB;
    var raw = localStorage.getItem(LS_KEY) || localStorage.getItem("laundryland_db") || localStorage.getItem("laundryland_db_v2");
    if(raw){ return JSON.parse(raw); }
  }catch(e){ log("getDB error "+e.message); }
  return {outlets:[],karyawans:[],pelanggans:[],layanans:[],notas:[],pengeluarans:[],setting:{}};
}

function saveDBLocal(db){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(db)); }catch(e){}
}

function initSupabase(){
  try{
    if(window.supabase && window.supabase.createClient){
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      log("Connected Laundry + SUPA");
      try{
        realtimeChannel = supabaseClient.channel("laundry-sync").on("postgres_changes",{event:"*",schema:"public",table:"laundry_backup"}, function(){
          log("Update HP lain - reload");
          setTimeout(()=>loadFromSupabase(true),800);
        }).subscribe();
      }catch(e){ log("Realtime fail "+e.message); }
      return true;
    }
  }catch(e){ log("Init fail "+e.message); }
  return false;
}

async function syncToSupabase(){
  if(!supabaseClient && !initSupabase()) return {ok:false, error:"no client"};
  try{
    var db = getDB();
    if(!db.outlets || db.outlets.length===0) return {ok:true, empty:true};

    // Dedup nota by no_nota (mirip makeKey WA parser)
    var map = new Map();
    (db.notas||[]).forEach(n=>map.set(makeKeyNota(n.no_nota||n.id), n));
    var dedupedNotas = Array.from(map.values());
    if(dedupedNotas.length < (db.notas||[]).length){
      db.notas = dedupedNotas;
      if(window.DB) window.DB.notas = dedupedNotas;
      saveDBLocal(db);
      window.dispatchEvent(new Event("storage"));
      log("Dedup notas "+(db.notas.length)+" dari "+map.size);
    }

    // Group by outlet_id (mirip byDate di WA parser)
    var byOutlet = new Map();
    dedupedNotas.forEach(n=>{
      var oid = n.outlet_id || (db.outlets[0] && db.outlets[0].id) || "default";
      if(!byOutlet.has(oid)) byOutlet.set(oid, []);
      byOutlet.get(oid).push(n);
    });

    // Pastikan minimal 1 outlet ke-sync walau nota kosong
    if(byOutlet.size===0 && db.outlets.length>0){
      byOutlet.set(db.outlets[0].id, []);
    }

    for(var entry of byOutlet.entries()){
      var outlet_id = entry[0];
      var notas = entry[1];
      var outlet = (db.outlets||[]).find(o=>o.id===outlet_id) || db.outlets[0] || {id:outlet_id, nama:"Outlet"};
      var totalNota = notas.length;
      var totalOmzet = notas.reduce((s,n)=>s+(parseInt(n.jumlah||0)||0),0);
      var totalPelanggan = (db.pelanggans||[]).filter(p=>!p.outlet_id || p.outlet_id===outlet_id).length;

      var payload = {
        outlet_id: outlet_id,
        outlet_nama: outlet.nama||"LaundryLand",
        total_nota: totalNota,
        total_omzet: totalOmzet,
        total_pelanggan: totalPelanggan,
        data: {
          outlet: outlet,
          outlets: db.outlets||[],
          karyawans: (db.karyawans||[]).filter(k=>!k.outlet_id || k.outlet_id===outlet_id || k.lintas),
          pelanggans: (db.pelanggans||[]).filter(p=>!p.outlet_id || p.outlet_id===outlet_id),
          layanans: db.layanans||[],
          notas: notas,
          pengeluarans: (db.pengeluarans||[]).filter(pe=>!pe.outlet_id || pe.outlet_id===outlet_id),
          setting: db.setting||{}
        },
        updated_at: new Date().toISOString()
      };

      log("Sync outlet "+outlet_id+" "+totalNota+" nota, omzet "+totalOmzet);
      var res = await supabaseClient.from("laundry_backup").upsert(payload, {onConflict:"outlet_id"});
      if(res.error) throw res.error;
    }

    log("Sync OK "+dedupedNotas.length+" nota total");
    return {ok:true, count:dedupedNotas.length};

  }catch(err){
    log("Sync fail: "+err.message);
    return {ok:false, error:err.message};
  }
}

async function loadFromSupabase(silent){
  if(!supabaseClient && !initSupabase()) return {ok:false};
  try{
    var localDB = getDB();
    var localKeys = new Set((localDB.notas||[]).map(n=>makeKeyNota(n.no_nota||n.id)));

    var res = await supabaseClient.from("laundry_backup").select("*").order("updated_at",{ascending:false}).limit(10);
    if(res.error) throw res.error;

    var imported = 0;
    var merged = {
      outlets: localDB.outlets||[],
      karyawans: localDB.karyawans||[],
      pelanggans: localDB.pelanggans||[],
      layanans: localDB.layanans||[],
      notas: (localDB.notas||[]).slice(),
      pengeluarans: localDB.pengeluarans||[],
      setting: localDB.setting||{}
    };

    var seenOutlet = new Set(merged.outlets.map(o=>o.id));
    var seenKaryawan = new Set(merged.karyawans.map(k=>k.id));
    var seenPelanggan = new Set(merged.pelanggans.map(p=>p.id));
    var seenLayanan = new Set(merged.layanans.map(l=>l.id));
    var seenNota = new Set(merged.notas.map(n=>makeKeyNota(n.no_nota||n.id)));
    var seenPengeluaran = new Set((merged.pengeluarans||[]).map(p=>p.id));

    for(var row of res.data||[]){
      var d = row.data||{};
      // outlet
      if(d.outlets) d.outlets.forEach(o=>{ if(!seenOutlet.has(o.id)){ merged.outlets.push(o); seenOutlet.add(o.id); } });
      if(d.outlet && !seenOutlet.has(d.outlet.id)){ merged.outlets.push(d.outlet); seenOutlet.add(d.outlet.id); }
      // karyawans
      (d.karyawans||[]).forEach(k=>{ if(!seenKaryawan.has(k.id)){ merged.karyawans.push(k); seenKaryawan.add(k.id); } });
      // pelanggans
      (d.pelanggans||[]).forEach(p=>{ if(!seenPelanggan.has(p.id)){ merged.pelanggans.push(p); seenPelanggan.add(p.id); imported++; } });
      // layanans
      (d.layanans||[]).forEach(l=>{ if(!seenLayanan.has(l.id)){ merged.layanans.push(l); seenLayanan.add(l.id); } });
      // notas (pakai makeKey)
      (d.notas||[]).forEach(n=>{
        var k = makeKeyNota(n.no_nota||n.id);
        if(!seenNota.has(k)){ merged.notas.push(n); seenNota.add(k); imported++; }
      });
      // pengeluarans
      (d.pengeluarans||[]).forEach(pe=>{ if(!seenPengeluaran.has(pe.id)){ merged.pengeluarans.push(pe); seenPengeluaran.add(pe.id); } });
    }

    if(imported>0){
      saveDBLocal(merged);
      if(window.DB){
        window.DB.outlets = merged.outlets;
        window.DB.karyawans = merged.karyawans;
        window.DB.pelanggans = merged.pelanggans;
        window.DB.layanans = merged.layanans;
        window.DB.notas = merged.notas;
        window.DB.pengeluarans = merged.pengeluarans;
        window.DB.setting = merged.setting;
      }
      log("Load "+imported+" baru dari Supabase");
      window.dispatchEvent(new Event("storage"));
      if(!silent && typeof renderAll==='function'){
        try{ renderAll(); }catch(e){}
      }
    }

    return {ok:true, imported:imported};

  }catch(err){
    log("Load fail: "+err.message);
    return {ok:false, error:err.message};
  }
}

window.LaundrySupabase={init:initSupabase, sync:syncToSupabase, load:loadFromSupabase};
window.SupabaseSync=window.LaundrySupabase; // alias biar kompatibel

var retry=0;
var t=setInterval(function(){
  if(initSupabase()){
    clearInterval(t);
    setTimeout(()=>loadFromSupabase(true),1000);
    setTimeout(()=>syncToSupabase(),2000);
  }else if(retry++>15){
    clearInterval(t);
    log("Init gagal setelah 15x - CDN supabase belum load?");
  }
},1000);

setInterval(()=>{ if(document.visibilityState==="visible") syncToSupabase(); },30000);
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") loadFromSupabase(true); });
window.addEventListener("laundry-updated", ()=>{ setTimeout(()=>syncToSupabase(),600); });
window.addEventListener("nota-updated", ()=>{ setTimeout(()=>syncToSupabase(),600); });

})();
