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
const supportsDialog=typeof HTMLDialogElement!=='undefined'&&typeof projectDialog.showModal==='function';
const openModal=element=>supportsDialog?element.showModal():element.classList.add('fallback-open');
const closeModal=element=>supportsDialog?element.close():element.classList.remove('fallback-open');
const toast=document.querySelector('#toast');
const showToast=(title,copy)=>{toast.querySelector('b').textContent=title;toast.querySelector('.toast-copy').textContent=copy;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3900)};

// Demo-only session state. The production API enforces the same role and verification checks server-side.
const session={role:null,verified:false};
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
    loginForm.elements.role.value=role;
  }
  openModal(authDialog);
}

function updateAccountStatus(){
  document.querySelector('.auth-actions .login-link').hidden=true;
  document.querySelector('.auth-actions .button').hidden=true;
  accountStatus.hidden=false;
  accountStatus.textContent=session.verified?`${session.role==='client'?'Cliente':'Empresa'} · verificada`:'Validación pendiente';
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

document.querySelectorAll('[data-open-project]').forEach(button=>button.addEventListener('click',()=>requireVerifiedRole('client',()=>openModal(projectDialog))));
document.querySelectorAll('[data-quote-project]').forEach(button=>button.addEventListener('click',()=>requireVerifiedRole('company',()=>showToast('Cotización habilitada',`Puedes preparar una propuesta para ${button.dataset.quoteProject}.`))));

loginForm.addEventListener('submit',event=>{
  event.preventDefault();
  if(!loginForm.checkValidity())return loginForm.reportValidity();
  session.role=loginForm.elements.role.value;
  session.verified=true;
  closeModal(authDialog);
  updateAccountStatus();
  showToast('Cuenta verificada',`Ingresaste como ${session.role==='client'?'cliente':'empresa'} con ticket activo.`);
  const action=pendingAction; pendingAction=null; if(action)setTimeout(action,250);
});

registerForm.addEventListener('submit',event=>{
  event.preventDefault();
  if(!registerForm.checkValidity())return registerForm.reportValidity();
  session.role=registerForm.elements.role.value;
  session.verified=false;
  pendingAction=null;
  closeModal(authDialog);
  updateAccountStatus();
  showToast('Solicitud enviada','Tu cuenta quedó pendiente. Te avisaremos cuando la revisión termine.');
});

document.querySelector('#projectForm').addEventListener('submit',event=>{event.preventDefault();if(!event.currentTarget.checkValidity())return event.currentTarget.reportValidity();closeModal(projectDialog);event.currentTarget.reset();showToast('Proyecto publicado','Tu proyecto ya puede recibir propuestas de empresas habilitadas.')});
document.querySelector('.recover-link').addEventListener('click',event=>{event.preventDefault();showToast('Recuperación segura','Te enviaremos un enlace de un solo uso con vigencia de una hora.')});
document.querySelectorAll('[data-quote]').forEach(button=>button.addEventListener('click',()=>showToast(button.dataset.quote,'Detalle de cotización disponible en la vista de cliente.')));
document.querySelectorAll('[data-company]').forEach(button=>button.addEventListener('click',()=>showToast(button.dataset.company,'Perfil, especialidades, ticket y portafolio disponibles en esta vista.')));
