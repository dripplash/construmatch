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
const passwordDialog=document.querySelector('#passwordDialog');
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
    ?'Revisaremos representante, RUT, razón social y registro de empresa. No podrás cotizar hasta ser habilitada.'
    :role==='professional'?'Revisaremos identidad, oficio, especialidad y credenciales disponibles. Podrás cotizar como profesional independiente.':'Revisaremos tu identidad antes de habilitar la publicación de proyectos.';
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
  if(loggedIn){const label=session.role==='client'?'Cliente':session.role==='company'?'Empresa':session.role==='professional'?'Profesional':'Administración';accountStatus.textContent=session.verified?`${label} · verificada`:`${session.displayName||'Cuenta'} · pendiente`}
}

function requireVerifiedRole(role,action){
  const roleMatches=role==='provider'?['company','professional'].includes(session.role):session.role===role;
  if(session.verified&&roleMatches)return action();
  pendingAction=action;
  const verb=role==='client'?'publicar proyectos':'enviar cotizaciones';
  openAuth('login',role==='provider'?null:role,`Para ${verb} necesitas una cuenta ${role==='client'?'de cliente validada':'de empresa o profesional habilitado'}.`);
}
function requireSession(action){if(session.id)return action();pendingAction=action;openAuth('login',null,'Inicia sesión para reportar contenido sospechoso.')}

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
passwordDialog.querySelector('.dialog-close').addEventListener('click',()=>closeModal(passwordDialog));

document.querySelectorAll('[data-open-project]').forEach(button=>button.addEventListener('click',()=>requireVerifiedRole('client',()=>openModal(projectDialog))));
document.querySelectorAll('[data-quote-project]').forEach(button=>button.addEventListener('click',()=>requireVerifiedRole('provider',()=>openQuoteDialog(button.dataset.projectId,button.dataset.quoteProject))));

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
    const user=await api('/api/auth/login',{method:'POST',body:JSON.stringify({identifier:payload.username,password:payload.password})});
    setSession(user);pendingAction=null;closeModal(authDialog);registerForm.reset();selectRegisterRole('client');
    showToast('Cuenta creada','Ahora completa la validación correspondiente a tu perfil.');const registrationInput=document.querySelector('#verificationForm [name="registrationReference"]');registrationInput.required=payload.role==='company';document.querySelector('#registrationReferenceLabel').hidden=payload.role==='client';setTimeout(()=>openModal(verificationDialog),250);
  }catch(error){showToast('No pudimos crear la cuenta',error.message)}finally{setSubmitting(registerForm,false)}
});

document.querySelector('#projectForm').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;if(!form.checkValidity())return form.reportValidity();setSubmitting(form,true);
  const payload=formPayload(form);payload.title=payload.name;delete payload.name;delete payload.photos;payload.budgetMin=Number(payload.budgetMin);payload.budgetMax=Number(payload.budgetMax);
  try{const files=[...form.elements.photos.files];if(files.length>5)throw new Error('Puedes adjuntar hasta 5 imágenes.');if(files.some(file=>file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)))throw new Error('Cada imagen debe ser JPG, PNG o WebP y pesar máximo 5 MB.');payload.uploadKeys=[];for(const file of files){const uploaded=await api('/api/uploads',{method:'POST',headers:{'Content-Type':file.type},body:file});payload.uploadKeys.push(uploaded.key)}await api('/api/projects',{method:'POST',body:JSON.stringify(payload)});closeModal(projectDialog);form.reset();showToast('Proyecto publicado','Ya puede recibir propuestas de empresas habilitadas.');await loadProjects()}
  catch(error){showToast('No pudimos publicar',error.message)}finally{setSubmitting(form,false)}
});

const quoteDialog=document.createElement('dialog');
quoteDialog.className='project-dialog';
quoteDialog.innerHTML='<form id="quoteForm"><button class="dialog-close" type="button" aria-label="Cerrar">×</button><p class="eyebrow"><span>+</span> Nueva cotización</p><h2>Prepara una propuesta comparable.</h2><input type="hidden" name="projectId"><div class="form-grid"><label>Monto total<input required type="number" min="1" inputmode="numeric" name="amount"></label><label>Duración estimada (días)<input required type="number" min="1" max="3650" inputmode="numeric" name="durationDays"></label><label class="full">Alcance<textarea required maxlength="6000" rows="6" name="scope" placeholder="Incluye partidas, exclusiones y condiciones"></textarea></label></div><button class="button button-primary full-button" type="submit">Enviar cotización <span>↗</span></button></form>';
document.body.append(quoteDialog);
quoteDialog.querySelector('.dialog-close').addEventListener('click',()=>closeModal(quoteDialog));
function openQuoteDialog(projectId,title){if(!projectId)return showToast('Proyecto de muestra','Las cotizaciones reales aparecerán cuando la API esté conectada.');quoteDialog.querySelector('[name="projectId"]').value=projectId;quoteDialog.querySelector('h2').textContent=`Cotizar: ${title}`;openModal(quoteDialog)}
quoteDialog.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;if(!form.checkValidity())return form.reportValidity();setSubmitting(form,true);const payload=formPayload(form);const projectId=payload.projectId;delete payload.projectId;payload.amount=Number(payload.amount);payload.durationDays=Number(payload.durationDays);try{await api(`/api/projects/${encodeURIComponent(projectId)}/quotes`,{method:'POST',body:JSON.stringify(payload)});closeModal(quoteDialog);form.reset();showToast('Cotización enviada','El cliente ya puede comparar tu propuesta.')}catch(error){showToast('No pudimos cotizar',error.message)}finally{setSubmitting(form,false)}});

const reportDialog=document.createElement('dialog');reportDialog.className='project-dialog';reportDialog.innerHTML='<form><button class="dialog-close" type="button" aria-label="Cerrar">×</button><p class="eyebrow"><span>!</span> Reporte confidencial</p><h2>Cuéntanos qué ocurre.</h2><input type="hidden" name="targetId"><div class="form-grid"><label class="full">Motivo<textarea required minlength="10" maxlength="1000" rows="5" name="reason" placeholder="Describe la posible estafa, dato falso o conducta indebida"></textarea></label></div><button class="button button-primary full-button" type="submit">Enviar reporte <span>↗</span></button></form>';document.body.append(reportDialog);reportDialog.querySelector('.dialog-close').addEventListener('click',()=>closeModal(reportDialog));reportDialog.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;if(!form.checkValidity())return form.reportValidity();setSubmitting(form,true);try{await api('/api/reports',{method:'POST',body:JSON.stringify({targetType:'project',...formPayload(form)})});closeModal(reportDialog);form.reset();showToast('Reporte recibido','Administración revisará el contenido y dejará registro de la decisión.')}catch(error){showToast('No pudimos reportar',error.message)}finally{setSubmitting(form,false)}});
function openReportDialog(projectId){reportDialog.querySelector('[name="targetId"]').value=projectId;openModal(reportDialog)}

const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(value));
async function loadProjects(){
  try{
    const projects=await api('/api/projects');
    document.querySelector('.project-list').innerHTML=Array.isArray(projects)&&projects.length?projects.map((project,index)=>`<article class="listing visible" data-category="${String(project.category).toLowerCase()}"><div class="listing-no">${String(index+1).padStart(2,'0')}</div><div class="listing-main"><span>${escapeHtml(project.category)} · ${escapeHtml(project.commune)}</span><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description)}</p></div><div class="listing-meta"><small>Presupuesto</small><strong>${money(project.budget_min)}–${money(project.budget_max)}</strong></div><div class="listing-meta"><small>Estado</small><strong>Abierto</strong></div><div class="listing-controls"><button class="listing-action quote-action" data-project-id="${project.id}">Cotizar ↗</button><button class="report-action" data-report-project="${project.id}">Reportar</button></div></article>`).join(''):'<div class="marketplace-state">Todavía no hay proyectos abiertos. Sé la primera persona en publicar uno.</div>';
    document.querySelectorAll('.project-list .quote-action').forEach(button=>button.addEventListener('click',()=>requireVerifiedRole('provider',()=>openQuoteDialog(button.dataset.projectId,button.closest('.listing').querySelector('h3').textContent))));
    document.querySelectorAll('.project-list .report-action').forEach(button=>button.addEventListener('click',()=>requireSession(()=>openReportDialog(button.dataset.reportProject))));
  }catch(error){document.querySelector('.project-list').innerHTML='<div class="marketplace-state error-state">No pudimos cargar los proyectos. Intenta actualizar la página.</div>'}
}
function escapeHtml(value){const element=document.createElement('span');element.textContent=String(value);return element.innerHTML}

async function loadCompanies(){
  try{
    const companies=await api('/api/companies');const grid=document.querySelector('.company-grid');
    grid.innerHTML=Array.isArray(companies)&&companies.length?companies.map(company=>`<article class="company-card visible"><div class="company-monogram">${escapeHtml(company.display_name.split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase())}</div><div><span class="availability"><i></i> ${company.role==='professional'?'Profesional independiente':'Empresa habilitada'}</span><h3>${escapeHtml(company.display_name)}</h3><p>Identidad y antecedentes básicos revisados por ConstruMatch.</p><div class="company-meta"><span>Ticket activo</span><b>Verificada</b></div></div></article>`).join(''):'<div class="marketplace-state light-state">Aún no hay prestadores habilitados para mostrar.</div>';
  }catch{document.querySelector('.company-grid').innerHTML='<div class="marketplace-state light-state">No pudimos cargar el directorio.</div>'}
}

accountStatus.addEventListener('click',()=>{if(session.role==='admin')return location.href='admin.html';if(!session.verified){const input=document.querySelector('#verificationForm [name="registrationReference"]');input.required=session.role==='company';document.querySelector('#registrationReferenceLabel').hidden=session.role==='client';openModal(verificationDialog)}else location.href='dashboard.html'});
document.querySelector('#verificationForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;if(!form.checkValidity())return form.reportValidity();setSubmitting(form,true);try{await api('/api/auth/verification',{method:'POST',body:JSON.stringify(formPayload(form))});closeModal(verificationDialog);form.reset();showToast('Solicitud enviada','Administración revisará tus antecedentes y dejará registro de la decisión.')}catch(error){showToast('No pudimos enviar la solicitud',error.message)}finally{setSubmitting(form,false)}});
document.querySelector('#logoutButton').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'});setSession(null);closeModal(verificationDialog);showToast('Sesión cerrada','Tu sesión se cerró en este dispositivo.')}catch(error){showToast('No pudimos cerrar sesión',error.message)}});
document.querySelector('#changePasswordButton').addEventListener('click',()=>{closeModal(verificationDialog);openModal(passwordDialog)});
document.querySelector('#passwordForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;if(!form.checkValidity())return form.reportValidity();setSubmitting(form,true);try{await api('/api/auth/change-password',{method:'POST',body:JSON.stringify(formPayload(form))});form.reset();closeModal(passwordDialog);setSession(null);showToast('Contraseña actualizada','Cerramos todas las sesiones. Ingresa nuevamente con tu nueva contraseña.')}catch(error){showToast('No pudimos cambiarla',error.message)}finally{setSubmitting(form,false)}});
function passwordScore(value){return [value.length>=12,/[A-Za-z]/.test(value),/\d/.test(value),/[^A-Za-z0-9]/.test(value),value.length>=16].filter(Boolean).length}
document.querySelectorAll('input[autocomplete="new-password"]').forEach(input=>input.addEventListener('input',()=>{const meter=input.parentElement.querySelector('.password-strength i');if(!meter)return;const score=passwordScore(input.value);meter.style.width=`${score*20}%`;meter.dataset.score=String(score)}));
api('/api/auth/me').then(setSession).catch(()=>setSession(null));
loadProjects();
loadCompanies();
