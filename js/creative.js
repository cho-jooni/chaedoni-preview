'use strict';
// 원본 사진과 가격은 그대로 두고, 먹는 법을 가볍게 탐색하는 기능입니다.
const tasteStories = {
  salt:{step:'첫 번째 한 점',title:'소금으로 담백하게.',lines:['잘 구운 고기에 소금을 살짝.','첫 점은 고기 본연의 맛부터 느껴 보세요.']},
  sauce:{step:'두 번째 한 점',title:'멜젓으로 깊은 맛.',lines:['다음 한 점은 멜젓에 곁들여 보세요.','연탄에 구운 고기와 함께 즐기는 조합입니다.']},
  roe:{step:'세 번째 한 점',title:'명란으로 색다르게.',lines:['고기 위에 명란을 살짝 올려 보세요.','채돈이의 한 점을 또 다른 맛으로 즐겨 보세요.']}
};
document.querySelectorAll('.taste-experience').forEach(section=>{
  const buttons=section.querySelectorAll('[data-taste]');
  const description=section.querySelector('.taste-description');
  buttons.forEach(button=>button.addEventListener('click',()=>{
    const story=tasteStories[button.dataset.taste];
    if(!story)return;
    buttons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    description.querySelector('.taste-step').textContent=story.step;
    description.querySelector('h3').textContent=story.title;
    const paragraph=description.querySelector('p');
    paragraph.replaceChildren(document.createTextNode(story.lines[0]),document.createElement('br'),document.createTextNode(story.lines[1]));
    description.classList.remove('is-changing');
    requestAnimationFrame(()=>description.classList.add('is-changing'));
  }));
});
const mascot=document.querySelector('.mascot-button');
if(mascot){
  const messages=['첫 점은 소금! 고기 맛부터 느껴 보세요.','다음 한 점은 멜젓과 함께!','명란을 올리면 또 다른 한 점!','가까운 채돈이에서 만나요!'];
  let index=0;
  mascot.addEventListener('click',()=>{
    document.querySelector('.greeting-bubble').textContent=messages[index++%messages.length];
    document.dispatchEvent(new Event('chef-greet'));
  });
}

// Fixed camera sprite poses: wave, then pick up and turn the meat.
const chef = document.querySelector('.chef-sprite');
const motionToggle = document.querySelector('.motion-toggle');
if (chef && motionToggle) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sequence = [0,1,2,1,2,0,3,4,5,3,4,5,3];
  let cursor = 0, timer = null, ready = false, visible = true;
  let paused = preference.matches;
  const showFrame = frame => {
    chef.style.backgroundPosition = `${(frame % 3) * 50}% ${frame < 3 ? 0 : 100}%`;
  };
  const stop = () => { window.clearTimeout(timer); timer = null; };
  const renderButton = () => {
    motionToggle.setAttribute('aria-pressed', String(paused));
    motionToggle.textContent = paused ? '동작 재생하기' : '동작 멈추기';
  };
  const tick = () => {
    stop();
    if (paused || !ready || !visible || document.hidden) return;
    showFrame(sequence[cursor]);
    const dwell = cursor === 0 || cursor === 6 || cursor === 12 ? 1100 : 420;
    cursor = (cursor + 1) % sequence.length;
    timer = window.setTimeout(tick, dwell);
  };
  motionToggle.addEventListener('click', () => {
    paused = !paused; renderButton(); tick();
  });
  document.addEventListener('chef-greet', () => {
    cursor = 0; showFrame(0); tick();
  });
  document.addEventListener('visibilitychange', tick);
  preference.addEventListener('change', event => {
    paused = event.matches; renderButton(); tick();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; tick();
    }).observe(chef.parentElement);
  }
  const sheet = new Image();
  sheet.onload = () => { ready = true; tick(); };
  sheet.onerror = () => { paused = true; renderButton(); motionToggle.disabled = true; motionToggle.textContent = '이미지 로딩 실패'; };
  sheet.src = 'img/generated/charcoal-chef-frames-v2.png';
  renderButton();
}
