let installed=false;

export function styleSaveDamageButton(button){
  button.classList.add('jj-btn','jj-damage-btn','oprpg-fixes-save-damage');
  button.title='Rolar dano da técnica';
  button.setAttribute('aria-label','Rolar dano da técnica');
  if(!button.querySelector('i'))button.innerHTML='<i class="fas fa-burst" aria-hidden="true"></i> Rolar dano';
  const card=button.closest('.jujutsu-card'),panels=card?.querySelector('.jj-panels,.jj-panel,.jj-footer');
  if(card && button.parentElement===card && panels && panels.parentElement===card)card.insertBefore(button,panels);
}

export function presentFixesChat(root){
  if(!root?.querySelectorAll)return;
  for(const button of root.querySelectorAll('[data-action="jj-save-damage"]'))styleSaveDamageButton(button);
  for(const card of root.querySelectorAll('.oprpg-save-request,.oprpg-damage-request,.haki-auto-chat')){
    card.classList.add('jujutsu-card','oprpg-fixes-notice');
    // Move the existing title, preserving its text and any listeners. Render
    // hooks may run twice on the same element or receive serialized HTML.
    const existingBar=card.querySelector(':scope > .jj-top-bar');
    const title=!existingBar&&Array.from(card.children).find(e=>e.tagName==='STRONG');
    if(title){const bar=document.createElement('div');bar.className='jj-top-bar';title.classList.add('jj-top-name');bar.append(title);card.prepend(bar);}
    let body=card.querySelector(':scope > .jj-description');
    if(!body){body=document.createElement('div');body.className='jj-description';card.insertBefore(body,card.querySelector(':scope > button'));}
    // Keep mixed text and inline emphasis in the same flow. Separate paragraphs
    // for each text node split sentences and left strong tags outside the skin.
    for(const node of Array.from(card.childNodes)){
      if(node===body||node===card.querySelector(':scope > .jj-top-bar')||node.nodeName==='BUTTON')continue;
      body.append(node);
    }
    for(const button of card.querySelectorAll('button')){
      button.classList.add('jj-btn');
      const reject=button.dataset.fixesDamageRequest==='reject';
      button.classList.add(reject?'jj-adv-btn':'jj-attack-btn');
      button.classList.add('oprpg-fixes-notice-action');
    }
  }
  for(const footer of root.querySelectorAll('[data-healing-mode] .jj-footer[data-oprpg-fixes-patched]')){
    footer.classList.add('oprpg-fixes-healing-footer');
    footer.style.removeProperty('border-top-color');
    footer.querySelector('.jj-footer-total')?.style.removeProperty('color');
    for(const button of footer.querySelectorAll('button')){
      for(const property of ['background','border-color','color'])button.style.removeProperty(property);
    }
  }
}

export function installPresentation(){
  if(installed)return;installed=true;
  Hooks.on('renderChatMessageHTML',(_message,html)=>presentFixesChat(html?.[0]??html));
}
