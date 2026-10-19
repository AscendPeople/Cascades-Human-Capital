(function(){
  /* nav */
  var burger=document.getElementById('burger'),nav=document.getElementById('nav');
  if(burger&&nav){
    burger.addEventListener('click',function(){
      var open=nav.classList.toggle('open');
      burger.setAttribute('aria-expanded',open?'true':'false');
      document.body.style.overflow=open?'hidden':'';
    });
    nav.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click',function(){
        nav.classList.remove('open');
        burger.setAttribute('aria-expanded','false');
        document.body.style.overflow='';
      });
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&nav.classList.contains('open')){
        nav.classList.remove('open');
        burger.setAttribute('aria-expanded','false');
        document.body.style.overflow='';
        burger.focus();
      }
    });
  }

  /* hero rotator */
  var slides=[].slice.call(document.querySelectorAll('.slide')),dots=document.getElementById('dots'),count=document.getElementById('count'),i=0,timer;
  if(slides.length){
    slides.forEach(function(s,n){
      var b=document.createElement('button');b.className='dot'+(n?'':' on');b.setAttribute('aria-label','Statement '+(n+1));
      b.addEventListener('click',function(){go(n);reset();});
      dots.appendChild(b);
    });
    function go(n){
      i=(n+slides.length)%slides.length;
      slides.forEach(function(s,k){s.classList.toggle('on',k===i);});
      dots.querySelectorAll('.dot').forEach(function(d,k){d.classList.toggle('on',k===i);});
      count.textContent=('0'+(i+1)).slice(-2)+' / '+('0'+slides.length).slice(-2);
    }
    var paused=false;
    function reset(){clearInterval(timer);if(!paused)timer=setInterval(function(){go(i+1);},4500);}
    var hero=document.querySelector('.hero');
    if(hero){
      var pb=document.createElement('button');
      pb.className='pause';pb.type='button';pb.setAttribute('aria-label','Pause the rotating statements');
      pb.textContent='Pause';
      pb.addEventListener('click',function(){
        paused=!paused;
        pb.textContent=paused?'Play':'Pause';
        pb.setAttribute('aria-label',paused?'Resume the rotating statements':'Pause the rotating statements');
        if(paused){clearInterval(timer);}else{reset();}
      });
      var railIn=hero.querySelector('.rail-in');
      if(railIn)railIn.appendChild(pb);
      hero.addEventListener('mouseenter',function(){clearInterval(timer);});
      hero.addEventListener('mouseleave',function(){if(!paused)reset();});
      hero.addEventListener('focusin',function(){clearInterval(timer);});
    }
    var mq=window.matchMedia('(prefers-reduced-motion: reduce)');
    go(0); if(!mq.matches) reset();
    window.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'){go(i+1);reset();}
      if(e.key==='ArrowLeft'){go(i-1);reset();}
    });
  }

  /* mega menu: open on hover/focus, close on a delay so the pointer can cross the gap */
  (function(){
    var items=[].slice.call(document.querySelectorAll('.nav .has-sub')),t;
    function closeAll(){items.forEach(function(i){i.classList.remove('open');});}
    items.forEach(function(item){
      var link=item.querySelector('a');
      function open(){clearTimeout(t);closeAll();item.classList.add('open');}
      function schedule(){clearTimeout(t);t=setTimeout(closeAll,320);}
      item.addEventListener('mouseenter',open);
      item.addEventListener('mouseleave',schedule);
      item.addEventListener('focusin',open);
      item.addEventListener('focusout',schedule);
    });
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeAll();});
  })();

  /* role tabs */
  document.querySelectorAll('[data-tabs]').forEach(function(group){
    var tabs=group.querySelectorAll('.tab'),panes=group.querySelectorAll('[data-pane]');
    tabs.forEach(function(t){
      t.addEventListener('click',function(){
        tabs.forEach(function(o){o.classList.toggle('on',o===t);});
        panes.forEach(function(p){p.style.display=(p.dataset.pane===t.dataset.tab)?'':'none';});
      });
    });
  });

  /* inquiry form: submit without leaving the page, with a visible result */
  var form=document.getElementById('inquiryForm'),status=document.getElementById('formStatus');
  if(form&&status){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var btn=form.querySelector('button[type="submit"]');
      if(btn){btn.disabled=true;btn.textContent='Sending…';}
      fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams(new FormData(form)).toString()})
        .then(function(r){
          if(!r.ok)throw new Error('bad response');
          status.hidden=false;status.setAttribute('data-state','ok');
          status.textContent='Thank you. Your inquiry is with us and we reply within one business day.';
          form.reset();
        })
        .catch(function(){
          status.hidden=false;status.setAttribute('data-state','err');
          status.innerHTML='Something went wrong sending that. Email <a href="mailto:admin@cascadeshcm.com">admin@cascadeshcm.com</a> and we will pick it up.';
        })
        .finally(function(){if(btn){btn.disabled=false;btn.textContent='Send inquiry';}});
    });
  }

  /* reveal */
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12,rootMargin:'0px 0px -6% 0px'});
    document.querySelectorAll('.reveal').forEach(function(e){io.observe(e);});
  }else{document.querySelectorAll('.reveal').forEach(function(e){e.classList.add('in');});}
})();
