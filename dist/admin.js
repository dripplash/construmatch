const toast=document.querySelector('#toast');
const login=document.querySelector('#adminLogin');
const panel=document.querySelector('#reviewPanel');
const list=document.querySelector('#verificationList');
const pendingCount=document.querySelector('#pendingCount');
const lastUpdated=document.querySelector('#lastUpdated');
const securityDialog=document.querySelector('#securityDialog');

const showToast=(title,copy)=>{toast.querySelector('b').textContent=title;toast.querySelector('.toast-copy').textContent=copy;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),3800)};
async function api(path,options={}){const response=await fetch(path,{credentials:'include',...options,headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});const data=response.status===204?null:await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data?.message||'Operación rechazada.');error.status=response.status;throw error}return data}
function setBusy(button,busy,label='Procesando…'){if(!button.dataset.label)button.dataset.label=button.innerHTML;button.disabled=busy;button.innerHTML=busy?label:button.dataset.label}
function escapeHtml(value){const element=document.createElement('span');element.textContent=String(value??'');return element.innerHTML}
function roleLabel(role){return role==='company'?'Empresa':'Cliente'}

async function load(){
  list.innerHTML='<div class="loading-state"><span></span><p>Cargando solicitudes…</p></div>';
  login.hidden=true;panel.hidden=false;
  const rows=await api('/api/admin/verifications');
  pendingCount.textContent=String(rows.length).padStart(2,'0');
  lastUpdated.textContent=`Actualizado ${new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}`;
  list.innerHTML=rows.length?rows.map((row,index)=>`<article class="review-card" data-user="${escapeHtml(row.user_id)}"><span class="review-number">${String(index+1).padStart(2,'0')}</span><div><h2>${escapeHtml(row.legal_name)}</h2><div class="review-meta"><b>${roleLabel(row.role)}</b><span>${escapeHtml(row.email)}</span><span>${new Date(row.submitted_at).toLocaleString('es-CL')}</span></div><div class="document-reference"><b>Referencia documental</b><br>${escapeHtml(row.document_reference)}</div></div><div class="review-actions"><textarea maxlength="800" aria-label="Motivo de la decisión para ${escapeHtml(row.legal_name)}" placeholder="Motivo obligatorio de la decisión"></textarea><button data-status="verified">Aprobar ticket</button><button class="reject" data-status="rejected">Rechazar solicitud</button></div></article>`).join(''):'<div class="empty-state"><strong>Todo revisado.</strong><span>No hay solicitudes pendientes en este momento.</span></div>';
  list.querySelectorAll('[data-status]').forEach(button=>button.addEventListener('click',()=>review(button)));
}

async function review(button){const card=button.closest('.review-card');const reason=card.querySelector('textarea').value.trim();if(!reason)return showToast('Falta el motivo','Registra el fundamento antes de decidir.');setBusy(button,true);card.querySelectorAll('button').forEach(item=>item.disabled=true);try{await api(`/api/admin/verifications/${card.dataset.user}/review`,{method:'POST',body:JSON.stringify({status:button.dataset.status,reason})});showToast('Decisión registrada','La cuenta y la bitácora fueron actualizadas.');await load()}catch(error){showToast('No se pudo revisar',error.message);card.querySelectorAll('button').forEach(item=>item.disabled=false);setBusy(button,false)}}

document.querySelector('#adminLoginForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=form.querySelector('[type="submit"]');if(!form.checkValidity())return form.reportValidity();setBusy(button,true,'Verificando…');try{await api('/api/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();await load()}catch(error){showToast('Acceso rechazado',error.message)}finally{setBusy(button,false)}});
document.querySelector('#refreshButton').addEventListener('click',async event=>{setBusy(event.currentTarget,true,'Actualizando…');try{await load()}catch(error){showToast('No se pudo actualizar',error.message)}finally{setBusy(event.currentTarget,false)}});
document.querySelector('#securityButton').addEventListener('click',()=>securityDialog.showModal());
document.querySelector('#closeSecurityButton').addEventListener('click',()=>securityDialog.close());
securityDialog.addEventListener('click',event=>{if(event.target===securityDialog)securityDialog.close()});
document.querySelector('#logoutButton').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'});panel.hidden=true;login.hidden=false;showToast('Sesión cerrada','El acceso administrativo se cerró correctamente.')}catch(error){showToast('No se pudo cerrar',error.message)}});
document.querySelector('#adminPasswordForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;if(!form.checkValidity())return form.reportValidity();const button=form.querySelector('[type="submit"]');setBusy(button,true);try{await api('/api/auth/change-password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();securityDialog.close();panel.hidden=true;login.hidden=false;showToast('Contraseña actualizada','Cerramos todas las sesiones. Ingresa nuevamente.')}catch(error){showToast('No se pudo cambiar',error.message)}finally{setBusy(button,false)}});

api('/api/auth/me').then(user=>{if(user.role!=='admin')throw new Error('not_admin');return load()}).catch(()=>{panel.hidden=true;login.hidden=false});
