'use strict';
// 프레임워크 없이 각 페이지에서 공통으로 사용하는 동작입니다.
const $ = (s) => document.querySelector(s);
const escapeHTML = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mapURL = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } };
const telURL = value => /^[\d\s()+-]+$/.test(value || '') ? 'tel:' + value.replace(/[^\d+]/g, '') : null;
const days = ['sun','mon','tue','wed','thu','fri','sat'];
function seoulClock(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Seoul',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p => [p.type,p.value]));
  return {day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday), minute:Number(parts.hour)*60+Number(parts.minute)};
}
function parseHours(value) {
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return null;
  const [,h,m,h2,m2] = match.map(Number);
  if (h>23 || h2>23 || m>59 || m2>59) return null;
  const start=h*60+m, end=h2*60+m2;
  if (start===end) return null;
  return {start,end: end<start ? end+1440 : end, close:value.split('-')[1]};
}
function businessStatus(branch, date = new Date()) {
  const {day,minute} = seoulClock(date);
  const previous = parseHours(branch.hours[days[(day+6)%7]]);
  if (previous && previous.end>1440 && minute+1440<previous.end) return `영업 중 · ${previous.close}까지`;
  const value=branch.hours[days[day]], current=parseHours(value);
  if (current && minute>=current.start && minute<current.end) return `영업 중 · ${current.close}까지`;
  // 전날 시간이 미확정이면 자정 이후 상태를 단정하지 않습니다.
  if (!previous && branch.hours[days[(day+6)%7]] !== 'closed') return '[확정 필요: 영업시간]';
  if (value==='closed') return '오늘 정기 휴무';
  if (!current) return '[확정 필요: 영업시간]';
  return minute<current.start ? `영업 전 · ${value.split('-')[0]}에 시작` : '오늘 영업 종료';
}
function todayHours(branch) { const value=branch.hours[days[seoulClock().day]]; return value==='closed' ? '오늘 정기 휴무' : parseHours(value) ? '오늘 '+value.replace('-', '–') : '[확정 필요: 오늘 영업시간]'; }
function mapLink(value,label,tracking='branch-map') {const url=mapURL(value); return url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" data-track="${tracking}">${label} ↗</a>` : `<span>${label} [확정 필요: URL]</span>`;}
function renderBranch(branch,full) {
  const tel=telURL(branch.tel);
  const hours=full ? '<dl>'+Object.entries(branch.hours).map(([day,value]) => `<dt>${({mon:'월요일',tue:'화요일',wed:'수요일',thu:'목요일',fri:'금요일',sat:'토요일',sun:'일요일'})[day]}</dt><dd>${escapeHTML(value==='closed'?'정기 휴무':value)}</dd>`).join('')+`<dt>주차</dt><dd>${escapeHTML(branch.parking)}</dd><dt>좌석</dt><dd>${escapeHTML(branch.seats)}</dd></dl><p>${escapeHTML(branch.note)}</p>` : '';
  return `<article class="card branch-card" id="branch-${escapeHTML(branch.id)}" data-track="branch-card" data-branch="${escapeHTML(branch.id)}"><h3><a href="branches.html#branch-${escapeHTML(branch.id)}" data-track="branch-card-click">${escapeHTML(branch.name)}</a></h3>${branch.sunday_open===true?'<span class="badge">일요일 영업</span>':''}<p>${escapeHTML(branch.address)}</p><p>${escapeHTML(todayHours(branch))}</p>${hours}<div class="branch-actions">${tel?`<a href="${tel}" data-track="phone-branch">${escapeHTML(branch.tel)}</a>`:`<span>${escapeHTML(branch.tel)}</span>`}${mapLink(branch.maps.naver,'네이버 길찾기')}${full?mapLink(branch.maps.kakao,'카카오맵')+mapLink(branch.maps.google,'구글 지도'):''}</div></article>`;
}
function openingSpecifications(branch) {
  const dayNames={mon:'Monday',tue:'Tuesday',wed:'Wednesday',thu:'Thursday',fri:'Friday',sat:'Saturday',sun:'Sunday'};
  return Object.entries(branch.hours).filter(([,value])=>parseHours(value)).map(([day,value])=>({'@type':'OpeningHoursSpecification',dayOfWeek:'https://schema.org/'+dayNames[day],opens:value.split('-')[0],closes:value.split('-')[1]}));
}
const navToggle=$('.nav-toggle');
navToggle?.addEventListener('click',()=>{const open=navToggle.getAttribute('aria-expanded')!=='true';navToggle.setAttribute('aria-expanded',String(open));navToggle.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');$('#site-nav').classList.toggle('open',open);});
document.addEventListener('keydown',event=>{if(event.key==='Escape' && navToggle?.getAttribute('aria-expanded')==='true'){navToggle.click();navToggle.focus();}});
document.querySelectorAll('.photo img').forEach(img=>{const sync=()=>img.parentElement.classList.add(img.naturalWidth?'loaded':'missing');img.addEventListener('load',sync);img.addEventListener('error',sync);if(img.complete)sync();});
function refreshFAQSchema() {
  const target=$('#faq-schema');if(!target)return;
  // 확인되지 않은 답변은 검색용 구조화 데이터에서 제외합니다.
  const entities=[...document.querySelectorAll('.faq-list details')].filter(d=>!d.querySelector('p').textContent.includes('[확정 필요')).map(d=>({'@type':'Question',name:d.querySelector('summary').textContent,acceptedAnswer:{'@type':'Answer',text:d.querySelector('p').textContent}}));
  target.textContent=JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:entities});
}
async function loadBranches() {
  try {
    const response=await fetch('data/branches.json');if(!response.ok)throw Error('지점 데이터 요청 실패');
    const {branches}=await response.json();
    document.querySelectorAll('[data-branches]').forEach(el=>el.innerHTML=branches.map(b=>renderBranch(b,el.dataset.branches==='full')).join(''));
    const main=branches.find(b=>b.id==='main');
    if(main){const status=$('#business-status');if(status){const update=()=>{status.textContent=businessStatus(main);};update();setInterval(update,60000);}
      document.querySelectorAll('[data-main-map]').forEach(a=>{const url=mapURL(main.maps[a.dataset.mainMap]);if(url){a.href=url;a.removeAttribute('aria-disabled');a.textContent=({naver:a.closest('.mobile-bar')?'본점 길찾기':'네이버 플레이스',kakao:'카카오맵',google:'구글 지도'})[a.dataset.mainMap];a.target='_blank';a.rel='noopener noreferrer';}});
    }
    const answer=$('#sunday-answer');if(answer){const unknown=branches.filter(b=>b.sunday_open===null);const open=branches.filter(b=>b.sunday_open===true).map(b=>b.name);answer.textContent=(open.length?open.join(', ')+'에서 일요일에 영업합니다.':unknown.length?'[확정 필요: 지점별 일요일 영업 여부].':'일요일 영업으로 등록된 지점이 없습니다.')+' '+(unknown.length?'[확정 필요: '+unknown.map(b=>b.name).join(', ')+' 일요일 영업 확인].':'방문 전 해당 지점의 영업시간을 확인해 주세요.');}
    const schema=$('#restaurant-schema');if(schema)schema.textContent=JSON.stringify({'@context':'https://schema.org','@graph':branches.map(b=>({'@type':'Restaurant',name:b.name,address:b.address,...(telURL(b.tel)?{telephone:b.tel}:{}),openingHoursSpecification:openingSpecifications(b),parentOrganization:{'@type':'Organization',name:'채돈이'}}))});
    refreshFAQSchema();
  } catch(error) {
    document.querySelectorAll('[data-branches]').forEach(el=>{el.innerHTML='<p>지점 정보를 불러오지 못했습니다. 새로고침하거나 <a href="tel:0316139001" data-track="phone-fallback">채돈이 본점 031-613-9001</a>으로 문의해 주세요.</p>';});
    console.error('지점 정보를 불러올 수 없습니다. 로컬 서버로 실행해 주세요.',error);refreshFAQSchema();
  }
}
loadBranches();
// 시·도 → 시·군·구. 경기 남부 방문권을 상세 제공하며 나머지 지역은 기타 직접입력을 지원합니다.
const regions={
 '서울특별시':['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'],
 '경기도':['수원시','성남시','의정부시','안양시','부천시','광명시','평택시','동두천시','안산시','고양시','과천시','구리시','남양주시','오산시','시흥시','군포시','의왕시','하남시','용인시','파주시','이천시','안성시','김포시','화성시','광주시','양주시','포천시','여주시','연천군','가평군','양평군'],
 '인천광역시':['중구','동구','미추홀구','연수구','남동구','부평구','계양구','서구','강화군','옹진군'],
 '부산광역시':[], '대구광역시':[], '광주광역시':[], '대전광역시':[], '울산광역시':[], '세종특별자치시':['세종특별자치시'], '강원특별자치도':[], '충청북도':[], '충청남도':[], '전북특별자치도':[], '전라남도':[], '경상북도':[], '경상남도':[], '제주특별자치도':['제주시','서귀포시']
};
const region=$('#region'), district=$('#district');
if(region){
  Object.keys(regions).forEach(name=>region.add(new Option(name,name)));
  const customLabel=document.createElement('label');customLabel.textContent='희망 시·군·구 직접 입력';customLabel.hidden=true;const custom=document.createElement('input');custom.name='districtCustom';custom.maxLength=80;customLabel.append(custom);district.closest('label').after(customLabel);
  const updateCustom=()=>{customLabel.hidden=district.value!=='직접 입력';custom.required=!customLabel.hidden;if(customLabel.hidden)custom.value='';};
  region.addEventListener('change',()=>{district.replaceChildren(new Option(region.value?'선택해 주세요':'시·도를 먼저 선택해 주세요',''));district.disabled=!region.value;(regions[region.value]||[]).forEach(name=>district.add(new Option(name,name)));if(region.value)district.add(new Option('직접 입력','직접 입력'));updateCustom();});
  district.addEventListener('change',updateCustom);
}
$('#inquiry-form')?.addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.currentTarget;if(!form.reportValidity())return;
  // 폼 백엔드 연결 필요. 실제 서비스에서는 서버 검증, 보관·파기 및 접수 결과 처리를 연결합니다.
  console.log('채돈이 수련 문의 (개발용, 실제 접수 아님)',Object.fromEntries(new FormData(form)));
  $('#form-status').textContent='문의 내용의 형식을 확인했습니다. 현재는 초안이므로 실제 접수되지 않았습니다. 상담은 채돈이 본점 031-613-9001로 전화해 주세요.';
});
// 모션은 점진적으로 적용합니다. 지원하지 않는 환경에서는 원래 콘텐츠를 표시합니다.
if (typeof window !== 'undefined' && 'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {threshold:0.06, rootMargin:'0px 0px -20px 0px'});
  const observeContent = scope => {
    scope.querySelectorAll('.section h2, .section>.eyebrow, .signature-photo, .signature-copy, .cards>.card, .cards>article, .stats>p, .timeline>li, .steps>li').forEach(el => {
      if (el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-reveal', '');
      const siblings = [...el.parentElement.children];
      const delay = el.parentElement.classList.contains('cards') ? Math.min(siblings.indexOf(el) % 3, 2)*85 : 0;
      el.style.setProperty('--reveal-delay', delay+'ms');
      revealObserver.observe(el);
    });
  };
  observeContent(document);
  document.documentElement.classList.add('motion-ready');
  // JSON으로 나중에 만들어지는 지점 카드에도 같은 등장 효과를 적용합니다.
  const dynamicCards = document.querySelectorAll('[data-branches]');
  dynamicCards.forEach(container => {
    new MutationObserver(() => observeContent(container)).observe(container, {childList:true});
  });
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
    if(event.matches) document.documentElement.classList.remove('motion-ready');
  });
}
