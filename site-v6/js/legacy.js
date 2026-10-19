(function(){
  var burger=document.getElementById('burger'),nav=document.getElementById('nav');
  if(burger&&nav){
    burger.addEventListener('click',function(){nav.classList.toggle('open');});
    nav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){nav.classList.remove('open');});});
  }
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
  },{threshold:.14,rootMargin:'0px 0px -6% 0px'});
  document.querySelectorAll('.reveal,.lc').forEach(function(e){io.observe(e);});
})();
