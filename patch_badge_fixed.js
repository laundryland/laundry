// BADGE NOTA HARI INI - Mirror Monitor Fixed - No Syntax Leak
(function(){
  function getTodayStr(){
    try{ return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}); }
    catch(e){ return new Date().toISOString().slice(0,10); }
  }
  function getTodayNotas(){
    try{
      var today = getTodayStr();
      if(!window.DB || !DB.notas) return [];
      var list = [];
      for(var i=0;i<DB.notas.length;i++){
        var n = DB.notas[i];
        try{
          var ds = new Date(n.tanggal).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
          var outletOk = !window.currentOutletId || !n.outlet_id || n.outlet_id===currentOutletId;
          if(ds===today && outletOk) list.push(n);
        }catch(e){}
      }
      list.sort(function(a,b){ return (b.tanggal||0)-(a.tanggal||0); });
      return list;
    }catch(e){ return []; }
  }
  function ensureBadge(){
    try{
      if(document.getElementById('badgeNotaHariIni')) return;
      var header = document.querySelector('.header');
      if(!header) return;
      var row = header.querySelector('div:nth-child(2)') || header;
      var badge = document.createElement('span');
      badge.id='badgeNotaHariIni';
      badge.style.cssText='background:#0e7490;color:white;padding:4px 10px;border-radius:20px;font-size:9px;font-weight:800;cursor:pointer;margin-left:6px;display:inline-flex;align-items:center;gap:4px';
      badge.textContent='📋 0 nota';
      badge.onclick=function(){ window.openModalNotaHariIni(); };
      row.appendChild(badge);
    }catch(e){}
  }
  function updateBadge(){
    try{
      var list = getTodayNotas();
      var el = document.getElementById('badgeNotaHariIni');
      if(!el){ ensureBadge(); return; }
      el.textContent='📋 '+list.length+' nota hari ini';
    }catch(e){}
  }
  window.openModalNotaHariIni=function(){
    try{
      var list = getTodayNotas();
      var modalId='modalNotaHariIni';
      var modal=document.getElementById(modalId);
      if(!modal){
        modal=document.createElement('div');
        modal.id=modalId;
        modal.className='modal';
        modal.innerHTML='<div class="modal-box" style="max-width:380px;max-height:85vh"><div class="title"><span>Nota Hari Ini</span><span class="icon-bundar" onclick="closeModal(\'modalNotaHariIni\')" style="width:28px;height:28px;background:#e5e7eb;color:#111">X</span></div><div id="notaHariIniContent" style="max-height:50vh;overflow:auto;display:flex;flex-direction:column;gap:6px"></div><div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-abu btn-full" onclick="closeModal(\'modalNotaHariIni\')">Tutup</button><button class="btn btn-hijau" style="flex:1" onclick="closeModal(\'modalNotaHariIni\');navigate(\'antrian\')">Buka Antrian</button></div></div>';
        document.body.appendChild(modal);
      }
      var contentEl=document.getElementById('notaHariIniContent');
      if(!contentEl) return;
      if(list.length===0){
        contentEl.innerHTML='<div class="small" style="text-align:center;padding:20px">Belum ada nota hari ini<br><span style="font-size:9px">Data lama aman - Hybrid anti-hilang</span></div>';
      }else{
        var html='';
        for(var i=0;i<list.length;i++){
          var n=list[i];
          var pel=null;
          try{ pel=DB.pelanggans.find(function(p){ return p.id===n.pelanggan_id; }); }catch(e){}
          var nama = pel && pel.nama ? pel.nama : (n.nama_pelanggan||'Pelanggan');
          var jumlah = n.jumlah||0;
          var noNota = n.no_nota||'';
          var id = n.id||'';
          html+='<div class="nota-card" style="padding:8px"><b>'+nama+'</b><br>'+noNota+' - Rp '+jumlah+'<br><button class="btn btn-abu" style="padding:4px 8px;font-size:10px" data-id="'+id+'" data-nota="'+noNota+'" onclick="openNotaDiAntrian(this.dataset.id)">Buka</button> <button class="btn btn-abu" style="padding:4px 8px;font-size:10px;background:#fee2e2" data-id="'+id+'" onclick="hapusNotaDariModal(this.dataset.id)">Hapus</button></div>';
        }
        contentEl.innerHTML=html;
      }
      if(typeof openModal==='function') openModal(modalId);
    }catch(e){ console.error(e); }
  };
  window.openNotaDiAntrian=function(id){
    try{
      closeModal('modalNotaHariIni');
      navigate('antrian');
      setTimeout(function(){
        var n=null;
        try{ n=DB.notas.find(function(x){ return x.id===id; }); }catch(e){}
        var searchEl=document.getElementById('searchAntrian');
        if(searchEl && n){ searchEl.value=n.no_nota; if(typeof renderAntrian==='function') renderAntrian(); }
      },400);
    }catch(e){}
  };
  window.hapusNotaDariModal=function(id){
    try{
      var n=null;
      try{ n=DB.notas.find(function(x){ return x.id===id; }); }catch(e){}
      if(!n) return;
      if(!confirm('Hapus nota hari ini?\n\n'+n.no_nota+'\nLanjutan buka Antrian')) return;
      if(typeof hapusNota==='function') hapusNota(id);
      else{
        DB.notas=DB.notas.filter(function(x){ return x.id!==id; });
        if(typeof saveDB==='function') saveDB(true);
      }
      closeModal('modalNotaHariIni');
      setTimeout(function(){ navigate('antrian'); if(typeof renderAntrian==='function') renderAntrian(); },300);
    }catch(e){}
  };
  var origRenderAll=window.renderAll;
  window.renderAll=function(){
    try{ if(origRenderAll) origRenderAll.apply(this,arguments); }catch(e){}
    try{ ensureBadge(); updateBadge(); }catch(e){}
  };
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ ensureBadge(); updateBadge(); },1000); });
  setInterval(function(){ try{ updateBadge(); }catch(e){} },5000);
})();
