const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const rooms=[
 {t:"채광 좋은 남향 원룸",l:"대현동 · 정문 도보 7분",p:"월세 50 / 보증금 500",g:3,bg:"#ece5d9",bl:"#9db8ae",pin:"50 / 500",x:52,y:62,m:"6.5평 · 2층",f:"세탁기·냉장고·에어컨 · 12월 입주",tip:"정문까지 도보 7분 · 이대역 도보 4분"},
 {t:"분리형 원룸, 방음 좋아요",l:"신촌동 · 정문 도보 12분",p:"월세 55 / 보증금 500",bg:"#e0ebe6",bl:"#dfb8a5",pin:"55",x:84,y:38,m:"7평 · 3층",f:"분리형 주방 · 도어락 · 12월 입주",tip:"정문까지 도보 12분 · 이대역 도보 8분"},
 {t:"풀옵션 신축 오피스텔",l:"아현동 · 정문 도보 15분",p:"월세 62 / 보증금 1000",g:5,bg:"#ede0dd",bl:"#a9b6d1",pin:"62",x:28,y:80,m:"8평 · 7층",f:"풀옵션 · 보안 우수 · 1월 입주",tip:"정문까지 도보 15분 · 이대역 도보 11분"},
 {t:"베란다 있는 복층 원룸",l:"북아현동 · 정문 도보 10분",p:"월세 48 / 보증금 500",bg:"#e5e8f0",bl:"#b3c8a5",pin:"48",x:86,y:80,m:"9평 · 복층",f:"베란다 · 세탁기 · 2월 입주",tip:"정문까지 도보 10분 · 이대역 도보 9분"}
];
const ph=r=>`<div class="ph" style="--bg:${r.bg};--bl:${r.bl}"><i></i><b></b></div>`;
const tags=(r,n)=>`<div class="tags"><span class="tg">살던 학생 소개</span>${r.g?`<span class="tg pe">물려주기${n?" "+r.g:""}</span>`:""}</div>`;

/* 홈 · 방 찾기 렌더링 */
if($("#homeGrid"))$("#homeGrid").innerHTML=rooms.map(r=>`<a class="card" href="detail.html">${ph(r)}<div class="bd">${tags(r)}<h4>${r.t}</h4><span class="lo">${r.l}</span><span class="pr">${r.p}</span></div></a>`).join("");
if($("#findRows")){
  $("#findRows").innerHTML=rooms.map((r,i)=>{const [d,w]=r.l.split(" · ");return `<div class="card" data-i="${i}">${ph(r)}<div class="bd">${tags(r,1)}<h4><a href="detail.html">${r.t}</a></h4><span class="lo">${d} · ${r.m} · ${w}</span><span class="lo">${r.f}</span><span class="pr">${r.p}</span></div></div>`}).join("");
  $("#pins").innerHTML=rooms.map((r,i)=>`<button class="pin" data-i="${i}" style="left:${r.x}%;top:${r.y}%">${r.pin}</button>`).join("");
  var pick=i=>{
    $$("#findRows .card,.pin").forEach(e=>e.classList.toggle("on",e.dataset.i==i));
    $("#tip").innerHTML=`<b>${rooms[i].t}</b><br>${rooms[i].tip}`;
    $("#route").classList.toggle("show",i==0);
  };
  pick(0);
}

/* 클릭 처리: 목록/핀 선택, 칩, 별점, 찜 */
document.addEventListener("click",e=>{
  const c=e.target.closest("#findRows .card,.pin");if(c&&!e.target.closest("a"))pick(c.dataset.i);
  const ch=e.target.closest(".chip");
  if(ch){const p=ch.parentNode;if(p.hasAttribute("data-single"))$$(".chip",p).forEach(x=>x.classList.remove("on"));ch.classList.toggle("on",p.hasAttribute("data-single")||!ch.classList.contains("on"));}
  const s=e.target.closest(".stars s");if(s){const st=s.parentNode;st.dataset.v=$$("s",st).indexOf(s)+1;stars(st);}
  const h=e.target.closest(".hb");if(h){h.classList.toggle("on");h.textContent=h.classList.contains("on")?"♥":"♡";}
});

/* 별점 · 슬라이더 · 글자 수 */
function stars(el){
  const v=+el.dataset.v;
  el.innerHTML=[1,2,3,4,5].map(n=>`<s class="${n<=v?"f":""}">★</s>`).join("");
  const l=el.nextElementSibling;if(l)l.textContent=el.dataset.dec?v.toFixed(1):v+"점";
}
$$(".stars").forEach(stars);
$$("input[type=range]").forEach(r=>{
  const u=()=>{r.style.setProperty("--p",r.value/r.max*100+"%");r.nextElementSibling.textContent=(+r.value).toFixed(1)};
  r.oninput=u;u();
});
$$("textarea[data-c]").forEach(t=>{const u=()=>t.nextElementSibling.textContent=t.value.length+" / 300";t.oninput=u;u();});

/* 사진 추가 기능 (방 내놓기: 최대 5장, 미리보기·삭제) */
$$("[data-up]").forEach(box=>{
  const max=+box.dataset.up,inp=$("input",box),btn=$(".upb",box),prev=$(box.dataset.prev);
  const sync=()=>{
    const f=$$(".th",box);btn.style.display=f.length>=max?"none":"";
    if(prev){const first=f[0];prev.classList.toggle("has",!!first);prev.style.backgroundImage=first?first.style.backgroundImage:"";}
  };
  btn.onclick=()=>inp.click();
  inp.onchange=()=>{
    [...inp.files].forEach(file=>{
      if($$(".th",box).length>=max)return;
      const d=document.createElement("div");d.className="th";d.style.backgroundImage=`url(${URL.createObjectURL(file)})`;
      d.innerHTML='<button type="button" aria-label="사진 삭제">×</button>';
      d.firstChild.onclick=()=>{d.remove();sync()};
      box.append(d);
    });
    inp.value="";sync();
  };
});

/* 사진 추가 기능 (매물 상세: 갤러리) */
const gal=$("[data-gal]");
if(gal){
  const max=+gal.dataset.gal,inp=$("input",gal),gm=$("#gm"),gt=$("#gt"),files=[];let cur=0;
  const draw=()=>{
    if(files[cur]){gm.style.backgroundImage=`url(${files[cur]})`;gm.innerHTML="";}
    else{gm.style.backgroundImage="";gm.innerHTML="<span>+</span>사진 추가";}
    gt.innerHTML=[0,1,2,3].map(i=>{
      const more=i==3&&files.length>4?`<small>+ ${files.length-3}장</small>`:"";
      return files[i]?`<div data-i="${i}" class="${i==cur?"on":""}" style="background-image:url(${files[i]})">${more}</div>`:`<div data-add>+</div>`;
    }).join("");
  };
  gm.onclick=()=>{if(!files[cur])inp.click()};
  gt.onclick=e=>{const t=e.target.closest("div[data-i],div[data-add]");if(!t)return;
    if(t.hasAttribute("data-add")){inp.click()}else{cur=+t.dataset.i;draw()}};
  inp.onchange=()=>{[...inp.files].forEach(f=>{if(files.length<max)files.push(URL.createObjectURL(f))});inp.value="";draw()};
  draw();
}
