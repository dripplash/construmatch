const loader=document.querySelector('#siteLoader');
const loaderMessage=document.querySelector('#loaderMessage');
const loaderPercent=document.querySelector('#loaderPercent');
const messages=['Trazando la estructura','Levantando los módulos','Asegurando las conexiones','Proyecto listo'];
let progress=0;
const loadTimer=setInterval(()=>{progress=Math.min(100,progress+Math.ceil(Math.random()*13));loaderPercent.textContent=`${progress}%`;loaderMessage.textContent=messages[Math.min(3,Math.floor(progress/28))];if(progress>=100){clearInterval(loadTimer);setTimeout(()=>loader.classList.add('done'),250)}},120);

const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){const delay=Number(entry.target.dataset.delay||0);setTimeout(()=>entry.target.classList.add('visible'),delay);observer.unobserve(entry.target)}})},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

const navToggle=document.querySelector('.nav-toggle');
const nav=document.querySelector('#mainNav');
navToggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');navToggle.setAttribute('aria-expanded',String(open))});
nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');navToggle.setAttribute('aria-expanded','false')}));

document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(item=>item.classList.remove('active'));button.classList.add('active');const filter=button.dataset.filter;document.querySelectorAll('.listing').forEach(item=>item.classList.toggle('hidden',filter!=='all'&&item.dataset.category!==filter))}));

document.querySelectorAll('.risk-item').forEach(item=>item.addEventListener('click',()=>{const isOpen=item.classList.contains('open');document.querySelectorAll('.risk-item').forEach(button=>{button.classList.remove('open');button.setAttribute('aria-expanded','false');button.querySelector('em').textContent='+'});if(!isOpen){item.classList.add('open');item.setAttribute('aria-expanded','true');item.querySelector('em').textContent='−'}}));

const projectDialog=document.querySelector('#projectDialog');
const authDialog=document.querySelector('#authDialog');
const verificationDialog=document.querySelector('#verificationDialog');
const supportsDialog=typeof HTMLDialogElement!=='undefined'&&typeof projectDialog.showModal==='function';
const openModal=element=>supportsDialog?element.showModal():element.classList.add('fallback-open');
const closeModal=element=>supportsDialog?element.close():element.classList.remove('fallback-open');
const toast=document.querySelector('#toast');
const showToast=(title,copy)=>{toast.querySelector('b').textContent=title;toast.querySelector('.toast-copy').textContent=copy;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3900)};

const API_BASE=(window.CONSTRUMATCH_API_URL||'').replace(/\/$/,'');
const session={id:null,role:null,verified:false,displayName:null};
let pendingAction=null;
const authContext=document.querySelector('#authContext');
const accountStatus=document.querySelector('#accountStatus');
const loginForm=document.querySelector('#loginForm');
const registerForm=document.querySelector('#registerForm');
const requirements=document.querySelector('#verificationRequirements');
const registerPassword=registerForm.querySelector('[name="password"]');
registerPassword.minLength=12;
registerPassword.placeholder='Mínimo 12 caracteres';
const legalConsent=document.createElement('label');
legalConsent.className='legal-consent';
legalConsent.innerHTML='<input type="checkbox" required> <span>Leí y acepto los <a href="legal.html#terminos" target="_blank" rel="noopener">Términos de uso</a> y reconozco la <a href="legal.html#privacidad" target="_blank" rel="noopener">Política de privacidad</a>.</span>';
registerForm.insertBefore(legalConsent,registerForm.querySelector('.full-button'));

function selectAuthTab(mode){
  document.querySelectorAll('[data-auth-tab]').forEach(button=>button.classList.toggle('active',button.dataset.authTab===mode));
  document.querySelectorAll('[data-auth-panel]').forEach(panel=>panel.hidden=panel.dataset.authPanel!==mode);
}

function selectRegisterRole(role){
  registerForm.elements.role.value=role;
  document.querySelectorAll('[data-role-choice]').forEach(button=>button.classList.toggle('active',button.dataset.roleChoice===role));
  requirements.textContent=role==='company'
    ?'Revisaremos identidad del representante, RUT, razón social, especialidades y cobertura. No podrás cotizar hasta recibir el ticket de empresa habilitada.'
    :'Confirmaremos correo, teléfono y documento de identidad. No podrás publicar hasta recibir el ticket de cliente validado.';
}

function openAuth(mode='login',role=null,message='Accede para continuar en ConstruMatch.'){
  authContext.textContent=message;
  selectAuthTab(mode);
  if(role){
    selectRegisterRole(role);
  }
  openModal(authDialog);
}

function updateAccountStatus(){
  const loggedIn=Boolean(session.id);
  document.querySelector('.auth-actions .login-link').hidden=loggedIn;
  document.querySelector('.auth-actions .button').hidden=loggedIn;
  accountStatus.hidden=!loggedIn;
  if(loggedIn)accountStatus.textContent=session.verified?`${session.role==='client'?'Cliente':'Empresa'} · verificada`:`${session.displayName||'Cuenta'} · pendiente`;
}

function requireVerifiedRole(role,action){
  if(session.verified&&session.role===role)return action();
  pendingAction=action;
  const verb=role==='client'?'publicar proyectos':'enviar cotizaciones';
  openAuth('login',role,`Para ${verb} necesitas iniciar sesión con una cuenta ${role==='client'?'de cliente validada':'de empresa habilitada'}.`);
}

document.querySelectorAll('[data-auth-open]').forEach(button=>button.addEventListener('click',()=>{
  const role=button.dataset.registerRole||null;
  openAuth(button.dataset.authOpen,role);
}));
document.querySelectorAll('[data-login]').forEach(button=>button.addEventListener('click',()=>openAuth('login')));
document.querySelectorAll('[data-auth-tab]').forEach(button=>button.addEventListener('click',()=>selectAuthTab(button.dataset.authTab)));
document.querySelectorAll('[data-role-choice]').forEach(button=>button.addEventListener('click',()=>selectRegisterRole(button.dataset.roleChoice)));
authDialog.querySelector('.dialog-close').addEventListener('click',()=>closeModal(authDialog));
projectDialog.querySelector('.dialog-close').addEventListener('click',event=>{event.preventDefault();closeModal(projectDialog)});
verificationDialog.querySelector('.dialog-close').addEventListener('click',()=>closeModal(verificationDialog));

document.querySelectorAll('[data-open-project]').forEach(button=>button.addEventListener('click',()=>requireVerifiedRole('client',()=>openModal(projectDialog))));
document.querySelectorAll('[data-quote-project]').forEach(button=>button.addEventListener('click',()=>requireVerifiedRole('company',()=>openQuoteDialog(button.dataset.projectId,button.dataset.quoteProject))));

async function api(path,options={}){
  const headers={Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers};
  const response=await fetch(`${API_BASE}${path}`,{credentials:'include',...options,headers});
  if(response.status===204)return null;
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.message||'No fue posible completar la operación.');error.code=data.error;error.status=response.status;throw error}
  return data;
}

function setSession(user){
  session.id=user?.id||null;
  session.role=user?.role||null;
  session.verified=user?.verificationStatus==='verified';
  session.displayName=user?.displayName||null;
  updateAccountStatus();
}

function setSubmitting(form,busy){
  const button=form.querySelector('[type="submit"]');
  if(button){button.disabled=busy;button.dataset.label||=button.innerHTML;button.innerHTML=busy?'Procesando…':button.dataset.label}
}

function formPayload(form){return Object.fromEntries(new FormData(form).entries())}

loginForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!loginForm.checkValidity())return loginForm.reportValidity();
  setSubmitting(loginForm,true);
  try{
    const user=await api('/api/auth/login',{method:'POST',body:JSON.stringify(formPayload(loginForm))});
    setSession(user);closeModal(authDialog);loginForm.reset();
    showToast('Sesión iniciada',session.verified?'Tu ticket de verificación está activo.':'Tu cuenta sigue pendiente de validación.');
    const action=pendingAction;pendingAction=null;if(action&&session.verified)setTimeout(action,250);
  }catch(error){showToast('No pudimos ingresar',error.message)}finally{setSubmitting(loginForm,false)}
});

registerForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!registerForm.checkValidity())return registerForm.reportValidity();
  setSubmitting(registerForm,true);
  const payload=formPayload(registerForm);
  try{
    await api('/api/auth/register',{method:'POST',body:JSON.stringify(payload)});
    const user=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:payload.email,password:payload.password})});
    setSession(user);pendingAction=null;closeModal(authDialog);registerForm.reset();selectRegisterRole('client');
    showToast('Cuenta creada','Tu cuenta quedó pendiente hasta completar la verificación.');
    setTimeout(()=>openModal(verificationDialog),250);
  }catch(error){showToast('No pudimos crear la cuenta',error.message)}finally{setSubmitting(registerForm,false)}
});

document.querySelector('#projectForm').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;if(!form.checkValidity())return form.reportValidity();setSubmitting(form,true);
  const payload=formPayload(form);payload.title=payload.name;delete payload.name;payload.budgetMin=Number(payload.budgetMin);payload.budgetMax=Number(payload.budgetMax);
  try{await api('/api/projects',{method:'POST',body:JSON.stringify(payload)});closeModal(projectDialog);form.reset();showToast('Proyecto publicado','Ya puede recibir propuestas de empresas habilitadas.');await loadProjects()}
  catch(error){showToast('No pudimos publicar',error.message)}finally{setSubmitting(form,false)}
});
document.querySelector('.recover-link').addEventListener('click',event=>{event.preventDefault();showToast('Recuperación segura','Te enviaremos un enlace de un solo uso con vigencia de una hora.')});
document.querySelectorAll('[data-quote]').forEach(button=>button.addEventListener('click',()=>showToast(button.dataset.quote,'Detalle de cotización disponible en la vista de cliente.')));
document.querySelectorAll('[data-company]').forEach(button=>button.addEventListener('click',()=>showToast(button.dataset.company,'Perfil, especialidades, ticket y portafolio disponibles en esta vista.')));

const quoteDialog=document.createElement('dialog');
quoteDialog.className='project-dialog';
quoteDialog.innerHTML='<form id="quoteForm"><button class="dialog-close" type="button" aria-label="Cerrar">×</button><p class="eyebrow"><span>+</span> Nueva cotización</p><h2>Prepara una propuesta comparable.</h2><input type="hidden" name="projectId"><div class="form-grid"><label>Monto total<input required type="number" min="1" inputmode="numeric" name="amount"></label><label>Duración estimada (días)<input required type="number" min="1" max="3650" inputmode="numeric" name="durationDays"></label><label class="full">Alcance<textarea required maxlength="6000" rows="6" name="scope" placeholder="Incluye partidas, exclusiones y condiciones"></textarea></label></div><button class="button button-primary full-button" type="submit">Enviar cotización <span>↗</span></button></form>';
document.body.append(quoteDialog);
quoteDialog.querySelector('.dialog-close').addEventListener('click',()=>closeModal(quoteDialog));
function openQuoteDialog(projectId,title){if(!projectId)return showToast('Proyecto de muestra','Las cotizaciones reales aparecerán cuando la API esté conectada.');quoteDialog.querySelector('[name="projectId"]').value=projectId;quoteDialog.querySelector('h2').textContent=`Cotizar: ${title}`;openModal(quoteDialog)}
quoteDialog.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;if(!form.checkValidity())return form.reportValidity();setSubmitting(form,true);const payload=formPayload(form);const projectId=payload.projectId;delete payload.projectId;payload.amount=Number(payload.amount);payload.durationDays=Number(payload.durationDays);try{await api(`/api/projects/${encodeURIComponent(projectId)}/quotes`,{method:'POST',body:JSON.stringify(payload)});closeModal(quoteDialog);form.reset();showToast('Cotización enviada','El cliente ya puede comparar tu propuesta.')}catch(error){showToast('No pudimos cotizar',error.message)}finally{setSubmitting(form,false)}});

const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(value));
async function loadProjects(){
  try{
    const projects=await api('/api/projects');if(!Array.isArray(projects)||!projects.length)return;
    document.querySelector('.project-list').innerHTML=projects.map((project,index)=>`<article class="listing visible" data-category="${String(project.category).toLowerCase()}"><div class="listing-no">${String(index+1).padStart(2,'0')}</div><div class="listing-main"><span>${project.category} · ${project.commune}</span><h3>${escapeHtml(project.title)}</h3></div><div class="listing-meta"><small>Presupuesto</small><strong>${money(project.budget_min)}–${money(project.budget_max)}</strong></div><div class="listing-meta"><small>Estado</small><strong>Abierto</strong></div><button class="listing-action quote-action" data-project-id="${project.id}">Cotizar ↗</button></article>`).join('');
    document.querySelectorAll('.project-list .quote-action').forEach(button=>button.addEventListener('click',()=>requireVerifiedRole('company',()=>openQuoteDialog(button.dataset.projectId,button.closest('.listing').querySelector('h3').textContent))));
  }catch(error){console.info('API de proyectos aún no disponible:',error.message)}
}
function escapeHtml(value){const element=document.createElement('span');element.textContent=String(value);return element.innerHTML}

accountStatus.addEventListener('click',()=>{if(session.role==='admin')location.href='admin.html';else if(!session.verified)openModal(verificationDialog);else showToast('Cuenta verificada','Tu ticket está activo y puedes utilizar las funciones de tu perfil.')});
document.querySelector('#verificationForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;if(!form.checkValidity())return form.reportValidity();setSubmitting(form,true);try{await api('/api/auth/verification',{method:'POST',body:JSON.stringify(formPayload(form))});closeModal(verificationDialog);form.reset();showToast('Solicitud enviada','Administración revisará tus antecedentes y dejará registro de la decisión.')}catch(error){showToast('No pudimos enviar la solicitud',error.message)}finally{setSubmitting(form,false)}});
document.querySelector('#logoutButton').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'});setSession(null);closeModal(verificationDialog);showToast('Sesión cerrada','Tu sesión se cerró en este dispositivo.')}catch(error){showToast('No pudimos cerrar sesión',error.message)}});
api('/api/auth/me').then(setSession).catch(()=>setSession(null));
loadProjects();
