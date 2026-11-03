const content=document.querySelector('#accountContent');const toast=document.querySelector('#toast');
const profileSection=document.querySelector('#providerProfileSection');
const profileForm=document.querySelector('#providerProfileForm');
const profileLogo=document.querySelector('#profileLogo');
const profileLogoPreview=document.querySelector('#profileLogoPreview');
const profileLogoFallback=document.querySelector('#profileLogoFallback');
const showToast=(title,copy)=>{toast.querySelector('b').textContent=title;toast.querySelector('.toast-copy').textContent=copy;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3500)};
async function api(path,options={}){const response=await fetch(path,{credentials:'include',...options,headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});const data=response.status===204?null:await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data?.message||'Operación rechazada.');error.status=response.status;throw error}return data}
const escapeHtml=value=>{const node=document.createElement('span');node.textContent=String(value??'');return node.innerHTML};const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(value));
function showProjectAction(show){
  let link=document.querySelector('#newProjectLink');
  if(!link&&show){
    link=document.createElement('a');
    link.id='newProjectLink';
    link.className='dashboard-primary';
    link.href='index.html?publish=1#inicio';
    link.textContent='Publicar proyecto';
    document.querySelector('#refreshButton').before(link);
  }
  if(link)link.hidden=!show;
}
async function load(){
  content.innerHTML='<div class="dashboard-empty">Cargando tu espacio…</div>';
  try{
    const [user,overview]=await Promise.all([api('/api/auth/me'),api('/api/account/overview')]);
    document.querySelector('#welcomeTitle').textContent=`Hola, ${user.displayName}.`;
    document.querySelector('#verificationStatus').textContent=user.verificationStatus==='verified'?'Verificada':user.verificationStatus==='rejected'?'Rechazada':'Pendiente';
    document.querySelector('#roleLabel').textContent=user.role==='client'?'Cuenta cliente':user.role==='professional'?'Profesional independiente':'Cuenta empresa';
    document.querySelector('#accountCopy').textContent=user.verificationStatus==='verified'?'Tu ticket está activo y las funciones de tu rol están habilitadas.':'Tu cuenta está creada, pero las acciones del marketplace esperan la validación administrativa.';
    profileSection.hidden=!['company','professional'].includes(user.role);
    if(!profileSection.hidden)await loadProviderProfile();
    if(overview.role==='client'){const canPublish=user.verificationStatus==='verified';showProjectAction(canPublish);renderClient(overview.projects||[],canPublish)}
    else if(overview.role==='company'||overview.role==='professional'){showProjectAction(false);renderCompany(overview.quotes||[])}
    else content.innerHTML='<div class="dashboard-empty">Esta cuenta utiliza el panel administrativo.</div>';
  }catch(error){
    if(error.status===401)return location.href='index.html';
    content.innerHTML=`<div class="dashboard-empty">${escapeHtml(error.message)}</div>`;
  }
}

function setLogoPreview(url,displayName){
  const initials=String(displayName||'CM').split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
  profileLogoFallback.textContent=initials||'CM';
  if(url){profileLogoPreview.src=url;profileLogoPreview.hidden=false;profileLogoFallback.hidden=true}
  else{profileLogoPreview.removeAttribute('src');profileLogoPreview.hidden=true;profileLogoFallback.hidden=false}
}

async function loadProviderProfile(){
  const profile=await api('/api/account/profile');
  profileForm.elements.displayName.value=profile.display_name||'';
  profileForm.elements.phone.value=profile.phone||'';
  profileForm.elements.publicEmail.value=profile.public_email||'';
  profileForm.elements.commune.value=profile.commune||'';
  profileForm.elements.specialties.value=profile.specialties||'';
  profileForm.elements.description.value=profile.description||'';
  profileForm.elements.website.value=profile.website||'';
  profileForm.elements.showContact.checked=profile.show_contact!==false;
  profileForm.dataset.logoUploadId=profile.logo_upload_id||'';
  setLogoPreview(profile.logo_url?`${profile.logo_url}?v=${Date.now()}`:null,profile.display_name);
}

profileLogo.addEventListener('change',()=>{
  const file=profileLogo.files[0];
  if(!file)return;
  if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){
    profileLogo.value='';
    return showToast('Logo no válido','Usa una imagen JPG, PNG o WebP de máximo 5 MB.');
  }
  setLogoPreview(URL.createObjectURL(file),profileForm.elements.displayName.value);
});

profileForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!profileForm.checkValidity())return profileForm.reportValidity();
  const button=profileForm.querySelector('[type="submit"]');
  button.disabled=true;button.textContent='Guardando…';
  try{
    let logoUploadId=profileForm.dataset.logoUploadId||null;
    const file=profileLogo.files[0];
    if(file){
      const uploaded=await api('/api/uploads',{method:'POST',headers:{'Content-Type':file.type},body:file});
      logoUploadId=uploaded.id;
    }
    const payload={
      displayName:profileForm.elements.displayName.value,
      phone:profileForm.elements.phone.value,
      publicEmail:profileForm.elements.publicEmail.value,
      commune:profileForm.elements.commune.value,
      specialties:profileForm.elements.specialties.value,
      description:profileForm.elements.description.value,
      website:profileForm.elements.website.value,
      showContact:profileForm.elements.showContact.checked,
      logoUploadId,
    };
    await api('/api/account/profile',{method:'PUT',body:JSON.stringify(payload)});
    profileLogo.value='';
    await loadProviderProfile();
    document.querySelector('#welcomeTitle').textContent=`Hola, ${payload.displayName}.`;
    showToast('Perfil actualizado','Tu información pública quedó guardada.');
  }catch(error){showToast('No pudimos guardar',error.message)}
  finally{button.disabled=false;button.textContent='Guardar perfil'}
});
function renderClient(projects,canPublish){document.querySelector('#contentTitle').textContent='Mis proyectos';content.innerHTML=projects.length?projects.map(project=>`<article class="dashboard-card" data-project="${project.id}"><div><span class="status-pill">${escapeHtml(project.status)}</span><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.category)} · ${escapeHtml(project.commune)}</p><p>${project.quote_count} cotizaciones recibidas</p></div><aside><strong>${money(project.budget_min)}–${money(project.budget_max)}</strong><button class="quotes-button">Ver cotizaciones</button><button class="messages-button">Mensajes</button></aside><div class="quote-list" hidden></div><div class="message-panel" hidden></div></article>`).join(''):canPublish?'<div class="dashboard-empty">Aún no has publicado proyectos. <a href="index.html?publish=1#inicio">Publicar el primero</a></div>':'<div class="dashboard-empty">Tu cuenta debe estar verificada antes de publicar proyectos.</div>';content.querySelectorAll('.quotes-button').forEach(button=>button.addEventListener('click',()=>loadQuotes(button.closest('article'))));content.querySelectorAll('.messages-button').forEach(button=>button.addEventListener('click',()=>loadMessages(button.closest('article'))))}
async function loadQuotes(card){const target=card.querySelector('.quote-list');target.hidden=false;target.innerHTML='Cargando…';try{const quotes=await api(`/api/projects/${card.dataset.project}/quotes`);target.innerHTML=quotes.length?quotes.map(quote=>`<div class="quote-row"><div><b>${escapeHtml(quote.company_name)}</b><p>${escapeHtml(quote.scope)}</p></div><span>${money(quote.amount)} · ${quote.duration_days} días</span>${quote.status==='submitted'?`<button data-quote="${quote.id}">Aceptar</button>`:`<b class="status-pill">${escapeHtml(quote.status)}</b>`}</div>`).join(''):'No hay cotizaciones todavía.';target.querySelectorAll('[data-quote]').forEach(button=>button.addEventListener('click',()=>acceptQuote(card.dataset.project,button.dataset.quote)))}catch(error){target.textContent=error.message}}
async function acceptQuote(projectId,quoteId){try{await api(`/api/projects/${projectId}/quotes/${quoteId}/accept`,{method:'POST',body:'{}'});showToast('Cotización aceptada','El proyecto cambió a contratado.');await load()}catch(error){showToast('No se pudo aceptar',error.message)}}
async function loadMessages(card){const panel=card.querySelector('.message-panel');panel.hidden=false;try{const messages=await api(`/api/projects/${card.dataset.project}/messages`);panel.innerHTML=`<div class="message-list">${messages.length?messages.map(message=>`<div class="message-item"><b>${escapeHtml(message.sender_name)}</b><br>${escapeHtml(message.body)}</div>`).join(''):'No hay mensajes todavía.'}</div><form class="message-form"><input required maxlength="2000" name="body" placeholder="Escribe un mensaje"><button>Enviar</button></form>`;panel.querySelector('form').addEventListener('submit',event=>sendMessage(event,card))}catch(error){panel.textContent=error.message}}
async function sendMessage(event,card){event.preventDefault();const form=event.currentTarget;try{await api(`/api/projects/${card.dataset.project}/messages`,{method:'POST',body:JSON.stringify({body:new FormData(form).get('body')})});await loadMessages(card)}catch(error){showToast('No se pudo enviar',error.message)}}
function renderCompany(quotes){document.querySelector('#contentTitle').textContent='Mis cotizaciones';content.innerHTML=quotes.length?quotes.map(quote=>`<article class="dashboard-card" data-project="${quote.project_id}"><div><span class="status-pill">${escapeHtml(quote.status)}</span><h3>${escapeHtml(quote.project_title)}</h3><p>${escapeHtml(quote.commune)} · ${quote.duration_days} días estimados</p><p>${escapeHtml(quote.scope)}</p></div><aside><strong>${money(quote.amount)}</strong>${quote.status==='accepted'?'<button class="messages-button">Mensajes</button>':''}</aside><div class="message-panel" hidden></div></article>`).join(''):'<div class="dashboard-empty">Aún no has enviado cotizaciones. <a href="index.html#proyectos">Explorar proyectos</a></div>';content.querySelectorAll('.messages-button').forEach(button=>button.addEventListener('click',()=>loadMessages(button.closest('article'))))}
document.querySelector('#refreshButton').addEventListener('click',load);document.querySelector('#logoutButton').addEventListener('click',async()=>{await api('/api/auth/logout',{method:'POST'});location.href='index.html'});load();
