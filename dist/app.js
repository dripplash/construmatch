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

const dialog=document.querySelector('#projectDialog');
const supportsDialog=typeof HTMLDialogElement!=='undefined'&&typeof dialog.showModal==='function';
const openDialog=()=>supportsDialog?dialog.showModal():dialog.classList.add('fallback-open');
const closeDialog=()=>supportsDialog?dialog.close():dialog.classList.remove('fallback-open');
document.querySelectorAll('[data-open-project]').forEach(button=>button.addEventListener('click',openDialog));
dialog.querySelector('.dialog-close').addEventListener('click',event=>{event.preventDefault();closeDialog()});
const form=document.querySelector('#projectForm');
const toast=document.querySelector('#toast');
const showToast=(title,copy)=>{toast.querySelector('b').textContent=title;toast.querySelector('.toast-copy').textContent=copy;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3900)};
form.addEventListener('submit',event=>{event.preventDefault();if(!form.checkValidity())return form.reportValidity();closeDialog();form.reset();showToast('Borrador creado','Ya puedes agregar presupuesto y fotografías.')});
const loginDialog=document.querySelector('#loginDialog');
const loginForm=document.querySelector('#loginForm');
const openLogin=()=>supportsDialog?loginDialog.showModal():loginDialog.classList.add('fallback-open');
const closeLogin=()=>supportsDialog?loginDialog.close():loginDialog.classList.remove('fallback-open');
document.querySelectorAll('[data-login]').forEach(button=>button.addEventListener('click',openLogin));
loginDialog.querySelector('.dialog-close').addEventListener('click',event=>{event.preventDefault();closeLogin()});
loginForm.addEventListener('submit',event=>{event.preventDefault();if(!loginForm.checkValidity())return loginForm.reportValidity();closeLogin();loginForm.reset();showToast('Acceso de demostración','El área privada se conectará al backend de ConstruMatch.')});
document.querySelectorAll('[data-quote]').forEach(button=>button.addEventListener('click',()=>showToast(button.dataset.quote,'Detalle de cotización disponible en la vista de cliente.')));
document.querySelectorAll('.listing-action').forEach(button=>button.addEventListener('click',()=>showToast('Proyecto seleccionado','Vista de detalle disponible en la plataforma.')));
document.querySelectorAll('[data-company]').forEach(button=>button.addEventListener('click',()=>showToast(button.dataset.company,'Perfil, especialidades y portafolio disponibles en esta vista.')));
