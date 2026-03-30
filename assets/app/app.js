function us(t){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",t,{once:!0});return}t()}function hs(){var yt;if(!((yt=document.body)!=null&&yt.classList.contains("app-shell-page")))return;const t=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches,e=document.createElement("canvas");e.className="glsl-canvas",e.setAttribute("aria-hidden","true"),document.body.prepend(e);const o=e.getContext("webgl",{alpha:!1,antialias:!1,depth:!1,stencil:!1,powerPreference:"low-power",preserveDrawingBuffer:!1});if(!o){e.remove();return}const i=`
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `,s=`
    precision mediump float;
    uniform vec2 u_res;
    uniform float u_time;
    varying vec2 v_uv;

    const float PI = 3.14159265;

    float glow(vec2 p, vec2 c, float r) {
      float d = length(p - c);
      return exp(-r * d * d);
    }

    float hash12(vec2 p) {
      vec3 p3  = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float rayMask(float a, float count, float width) {
      float x = fract(a * count);
      float dist = abs(x - 0.5);
      return smoothstep(width, 0.0, dist);
    }

    void main() {
      vec2 p = (gl_FragCoord.xy / u_res) * 2.0 - 1.0;
      p.x *= u_res.x / u_res.y;

      float t = u_time * 6.2831853;
      vec2 drift = vec2(0.16 * sin(t * 0.7), 0.16 * cos(t * 0.6));
      p += drift;
      float r = length(p);

      vec2 c1 = vec2(0.75 * cos(t * 0.9), 0.60 * sin(t));
      vec2 c2 = vec2(0.70 * cos(t * 1.1 + 2.2), 0.55 * sin(t * 0.8 + 2.2));
      vec2 c3 = vec2(0.60 * cos(t * 0.7 + 4.0), 0.50 * sin(t * 1.2 + 4.0));

      float g1 = glow(p, c1, 2.4);
      float g2 = glow(p, c2, 2.1);
      float g3 = glow(p, c3, 2.6);

      float pulse = 0.78 + 0.22 * sin(t * 2.2);
      vec3 col = vec3(0.03, 0.02, 0.07);
      col += g1 * vec3(0.48, 0.16, 0.85) * pulse;
      col += g2 * vec3(0.12, 0.28, 0.85) * (1.0 - pulse * 0.25);
      col += g3 * vec3(0.70, 0.18, 0.55) * (0.85 + 0.15 * sin(t * 1.6));

      float grad = (p.y * 0.5 + 0.5);
      col += vec3(0.03, 0.01, 0.06) * grad;

      float v = smoothstep(1.25, 0.35, r);
      col *= mix(0.75, 1.0, v);

      float angle = atan(p.y, p.x) + t * 1.3;
      float a = (angle + PI) / (2.0 * PI);
      float rayCountA = 18.0;
      float rayCountB = 11.0;
      float baseIdA = floor(a * rayCountA);
      float baseIdB = floor(a * rayCountB);
      float jitterA = (hash12(vec2(baseIdA, 5.3)) - 0.5) * (0.9 / rayCountA);
      float jitterB = (hash12(vec2(baseIdB, 7.1)) - 0.5) * (1.2 / rayCountB);
      float phaseA = hash12(vec2(baseIdA, 1.7)) * 6.2831853;
      float phaseB = hash12(vec2(baseIdB, 9.2)) * 6.2831853;
      float wobbleA = sin(t * 1.4 + phaseA) * (0.6 / rayCountA);
      float wobbleB = sin(t * 1.0 + phaseB) * (0.5 / rayCountB);
      float aA = a + jitterA + wobbleA;
      float aB = a + jitterB + wobbleB;
      float rayA = rayMask(aA, rayCountA, 0.22);
      float rayB = rayMask(aB, rayCountB, 0.30);
      float ray = clamp(rayA * 0.6 + rayB * 0.5, 0.0, 1.0);
      float rayId = floor(fract(aA) * rayCountA);
      float amp = mix(0.2, 1.0, hash12(vec2(rayId, rayId + 1.7)));
      ray *= amp;

      float edge = smoothstep(0.20, 1.25, r);
      edge *= edge;
      float streak = ray * edge;
      vec3 beamColor = vec3(1.0, 0.94, 0.78);
      float beamStrength = streak * 0.62;
      col *= (1.0 + beamColor * beamStrength);

      float dither = (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
      col += dither;

      col = clamp(col, 0.0, 1.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `,r=(M,K)=>{const B=o.createShader(M);return o.shaderSource(B,K),o.compileShader(B),o.getShaderParameter(B,o.COMPILE_STATUS)?B:(console.warn("GLSL compile failed:",o.getShaderInfoLog(B)),o.deleteShader(B),null)},n=r(o.VERTEX_SHADER,i),l=r(o.FRAGMENT_SHADER,s);if(!n||!l){e.remove();return}const c=o.createProgram();if(o.attachShader(c,n),o.attachShader(c,l),o.linkProgram(c),!o.getProgramParameter(c,o.LINK_STATUS)){console.warn("GLSL link failed:",o.getProgramInfoLog(c)),e.remove();return}o.useProgram(c),o.disable(o.DEPTH_TEST),o.disable(o.BLEND);const p=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,p),o.bufferData(o.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),o.STATIC_DRAW);const b=o.getAttribLocation(c,"a_pos");o.enableVertexAttribArray(b),o.vertexAttribPointer(b,2,o.FLOAT,!1,0,0);const f=o.getUniformLocation(c,"u_res"),y=o.getUniformLocation(c,"u_time"),v=.5,w=1.5,k=()=>{const M=Math.min(window.devicePixelRatio||1,w),K=Math.max(1,Math.floor(window.innerWidth*M*v)),B=Math.max(1,Math.floor(window.innerHeight*M*v));(e.width!==K||e.height!==B)&&(e.width=K,e.height=B,o.viewport(0,0,K,B),o.uniform2f(f,K,B))};document.body.classList.add("glsl-bg"),k(),window.addEventListener("resize",k);const C=80,x=1e3/30,$=performance.now();let z=0,O=0,V=!1,A=document.hasFocus(),E=null,at=0;const st=M=>{const B=(M-$-at)/1e3%C/C;o.uniform1f(y,B),o.clearColor(0,0,0,1),o.clear(o.COLOR_BUFFER_BIT),o.drawArrays(o.TRIANGLES,0,3)},J=()=>!t&&!document.hidden&&A,ut=M=>{if(!J()){V=!1,O=0;return}M-z>=x&&(z=M,st(M)),O=requestAnimationFrame(ut)},ct=()=>{V&&(E===null&&(E=performance.now()),V=!1,O&&(cancelAnimationFrame(O),O=0))},ht=()=>{!J()||V||(E!==null&&(at+=performance.now()-E,E=null),z=0,V=!0,O=requestAnimationFrame(ut))},U=()=>{if(J()){ht();return}ct()};st($),ht(),document.addEventListener("visibilitychange",U),window.addEventListener("focus",()=>{A=!0,U()}),window.addEventListener("blur",()=>{A=!1,U()})}function ps(){var ti;if(!((ti=document.body)!=null&&ti.classList.contains("app-shell-page")))return;const t=d=>document.getElementById(d),e=document.body.dataset.runToken||"",o="nas_linker_saved",i={torrents:document.body.dataset.rootTorrents||"",movies:document.body.dataset.rootMovies||"",tv:document.body.dataset.rootTv||""};let s=null,r=[],n=!1,l="",c="",p=null;function b(){t("log").textContent=c}function f(d){c=String(d??""),b()}function y(d){return!!(d!=null&&d.sessionExpired)}function v(d){p=d,t("session_message").textContent=d.message,t("session_hint").textContent=d.hint,f(`[session] ${d.kind}: ${d.message}`),t("session_modal").show()}function w(d){return(d.headers.get("x-nas-linker-auth")||"").toLowerCase()==="session"?{kind:"auth",message:"Authentication was lost or expired.",hint:"Reload the page and sign in again."}:{kind:"runtime",message:"The helper session changed, likely after a restart.",hint:"Reload the page to refresh the runtime token."}}function k(d,h,m){const g=t(d);g.classList.remove("hidden");const _=h==="ok"?"success":h==="error"?"danger":h==="warn"?"warning":"neutral";g.setAttribute("variant",_),g.textContent=m}function C(d,h,m){k(d,h,`Search: ${m}`)}function x(d,h,m){k(d,h,`Link: ${m}`)}function $(d,h,m){try{const g=document.createElement("sl-alert");if(g.variant=d==="ok"?"success":d==="error"?"danger":"primary",g.closable=!0,g.duration=3e3,g.innerHTML=`<strong>${h}</strong><br/>${m}`,document.body.appendChild(g),typeof g.toast=="function"){g.toast(),g.addEventListener("sl-after-hide",()=>g.remove());return}g.open=!0,setTimeout(()=>{g.remove()},3e3)}catch(g){console.error("Toast failed",g),f(`[toast-fallback] ${h}: ${m}`)}}function z(d){d&&(d.content="Скопировано!",d.show(),setTimeout(()=>{d.hide(),d.content="Copy path"},1500))}async function O(d,{method:h="GET",body:m}={}){if(p)return v(p),{ok:!1,status:401,data:{ok:!1,error:"session expired"},sessionExpired:!0};const g={"x-run-token":e};m!==void 0&&(g["content-type"]="application/json");const _=await fetch(d,{method:h,headers:g,body:m===void 0?void 0:JSON.stringify(m)}),D=await _.json().catch(()=>({}));if(_.status===401||_.status===403){const Y=w(_);return v(Y),{ok:!1,status:_.status,data:D,sessionExpired:!0}}return{ok:_.ok&&D.ok!==!1,status:_.status,data:D,sessionExpired:!1}}function V(d){const h=document.createElement("textarea");h.value=d,h.setAttribute("readonly",""),h.style.position="absolute",h.style.left="-9999px",document.body.appendChild(h),h.select();try{return document.execCommand("copy")}catch{return!1}finally{h.remove()}}function A(d){const h=t(d);h&&(h.classList.add("flash"),setTimeout(()=>h.classList.remove("flash"),700))}function E(d){const h=t(d);return String((h==null?void 0:h.value)??"").trim()}function at(d,h){let m=null;return(...g)=>{clearTimeout(m),m=setTimeout(()=>d(...g),h)}}const st=at(async()=>{var g;const d=t("m_title").value.trim(),h=t("m_year").value.trim();if(d.length<2){pt("m_ac");return}const m=await oo("movie",d,h,8);if(!m.ok){pt("m_ac");return}Qo("m_ac",((g=m.data)==null?void 0:g.items)??[],"movie")},350),J=at(async()=>{var g;const d=t("s_title").value.trim(),h=t("s_year").value.trim();if(d.length<2){pt("s_ac");return}const m=await oo("show",d,h,8);if(!m.ok){pt("s_ac");return}Qo("s_ac",((g=m.data)==null?void 0:g.items)??[],"show")},350);t("clear_log").onclick=()=>f(""),t("open_log").onclick=()=>t("log_modal").show();function ut(){try{const d=localStorage.getItem(o),h=d?JSON.parse(d):[];return Array.isArray(h)?h:[]}catch{return[]}}function ct(){return r.slice()}function ht(d){return{id:d.id,type:d.kind,src:d.kind==="movie"&&d.srcPath||"",srcDir:d.kind==="season"&&d.srcPath||"",title:d.title,season:d.season!=null?String(d.season):"",year:d.year!=null?String(d.year):"",createdAt:d.createdAt||"",updatedAt:d.updatedAt||""}}function U(d){return{kind:d.type,title:d.title,year:d.year,season:d.type==="season"?d.season:void 0,srcPath:d.type==="movie"?d.src:d.srcDir}}async function yt(d){return O(d)}async function M(){var h,m;const d=await yt("/api/saved-templates");return y(d)?d:d.ok?(r=(((m=d.data)==null?void 0:m.items)??[]).map(ht),n=!0,l="",to(),d):(r=[],n=!0,l=((h=d.data)==null?void 0:h.error)||`HTTP ${d.status}`,to(),d)}async function K(){const d=ut();if(!(r.length>0||d.length===0)){for(const h of d){const m=U(h),g=await oe("/api/saved-templates",m);if(y(g))return;if(!g.ok){console.error("Failed to bootstrap saved template",g),l="Saved bootstrap failed";break}}await M()}}async function B(){const d=await M();if(!y(d)){if(!d.ok){$("error","Saved unavailable",l||"Failed to load saved templates");return}await K()}}async function xt(d){var m;const h=await oe("/api/saved-templates",U(d));if(y(h))return!1;if(!h.ok){const g=((m=h.data)==null?void 0:m.error)||`HTTP ${h.status}`;return $("error","Save failed",g),!1}return await M(),!0}async function Qe(d){var m;const h=await oe("/api/saved-templates/delete",{id:d});if(y(h))return!1;if(!h.ok){const g=((m=h.data)==null?void 0:m.error)||`HTTP ${h.status}`;return $("error","Delete failed",g),!1}return await M(),!0}function jo(d){const h=t(d);return!!(h!=null&&h.checked||h!=null&&h.hasAttribute("checked"))}function rs(){return{type:"movie",src:E("m_src"),title:E("m_title"),year:E("m_year")}}function ns(){return{type:"season",srcDir:E("s_src"),title:E("s_title"),season:E("s_season"),year:E("s_year")}}function qo(){return{src:E("m_src"),title:E("m_title"),year:E("m_year")}}function Ko(){return{srcDir:E("s_src"),title:E("s_title"),season:E("s_season"),year:E("s_year")}}function as(d){const h=d==="movie"?qo():Ko();return d==="movie"?h.src?h.title?/^\d{4}$/.test(h.year)?null:"m_year":"m_title":"m_src":h.srcDir?h.title?/^\d+$/.test(h.season)?/^\d{4}$/.test(h.year)?null:"s_year":"s_season":"s_title":"s_src"}function Yo(d){const h=d==="movie"?qo():Ko();return d==="movie"?h.src?h.title?h.year?/^\d{4}$/.test(h.year)?"":"Year must be YYYY":"Need year":"Need title":"Need source path":h.srcDir?h.title?h.season?/^\d+$/.test(h.season)?h.year?/^\d{4}$/.test(h.year)?"":"Year must be YYYY":"Need year":"Season must be numeric":"Need season":"Need title":"Need source folder"}function Le(d){return Yo(d)===""}function It(){t("m_run").disabled=!Le("movie"),t("s_run").disabled=!Le("season")}function Xo(d){const h=d==="movie"?"m_status":"s_status",m=as(d),g=Yo(d);m&&A(m),g&&x(h,"warn",g)}function to(){const d=t("saved_list"),h=ct();if(d.innerHTML="",!n){const m=document.createElement("sl-alert");m.variant="neutral",m.open=!0,m.className="text-xs",m.textContent="Loading saved items...",d.appendChild(m);return}if(l){const m=document.createElement("sl-alert");m.variant="warning",m.open=!0,m.className="text-xs",m.textContent=`Saved unavailable: ${l}`,d.appendChild(m);return}if(h.length===0){const m=document.createElement("sl-alert");m.variant="neutral",m.open=!0,m.className="text-xs",m.textContent="Нет сохраненных элементов",d.appendChild(m);return}for(const m of h){const g=document.createElement("li");g.className="border-b border-slate-100 last:border-b-0 py-1.5 text-slate-800";const _=document.createElement("sl-tooltip");_.content=m.type==="movie"?m.src||"":m.srcDir||"",_.setAttribute("placement","top");const D=document.createElement("div");D.className="flex items-center gap-2 min-w-0";const W=document.createElement("span");W.className="truncate flex-1 min-w-0";const Y=m.type==="season"?` • S${m.season}`:"";W.textContent=`${m.title}${Y} • ${m.year}`,D.appendChild(W);const F=document.createElement("div");F.className="ml-2 flex items-center gap-2 text-xs flex-shrink-0";const Z=document.createElement("sl-button");Z.setAttribute("size","small"),Z.setAttribute("variant","text");const ft=document.createElement("sl-icon");ft.setAttribute("name","box-arrow-in-right"),ft.className="text-blue-600",Z.appendChild(ft);const rt=document.createElement("sl-tooltip");rt.content="Fill form",rt.appendChild(Z),Z.onclick=()=>{m.type==="movie"?(t("m_src").value=m.src||"",t("m_title").value=m.title,t("m_year").value=m.year,A("m_src"),A("m_title"),A("m_year"),Zo("movie")):(t("s_src").value=m.srcDir||"",t("s_title").value=m.title,t("s_season").value=m.season,t("s_year").value=m.year,A("s_src"),A("s_title"),A("s_season"),A("s_year"),Zo("show")),It()},F.appendChild(rt);const Q=document.createElement("sl-button");Q.setAttribute("size","small"),Q.setAttribute("variant","text");const bt=document.createElement("sl-icon");bt.setAttribute("name","trash"),bt.className="text-rose-600",Q.appendChild(bt);const nt=document.createElement("sl-tooltip");nt.content="Delete",nt.appendChild(Q),Q.onclick=()=>{s=m.id,t("confirm_delete").show()},F.appendChild(nt),D.appendChild(F),_.appendChild(D),g.appendChild(_),d.appendChild(g)}}function ls(d){if(!d)return;const h=t("preview_modal"),m=t("preview_modal_img");m.src=d,h.show()}async function Go(d,h){const m=await O(d,{method:"POST",body:h}),g=m.data||{},_=`HTTP ${m.status}
`+(g.stdout||"")+(g.stderr?`
[stderr]
${g.stderr}`:"");return{ok:m.ok,status:m.status,data:g,text:_,sessionExpired:m.sessionExpired}}async function oe(d,h){return O(d,{method:"POST",body:h})}function pt(d){const h=t(d);h&&(h.classList.add("hidden"),h.innerHTML="")}function Jo(d){const h=t(d);h&&h.classList.remove("hidden")}function eo(d,h,m){const g=t(d);if(g.innerHTML="",!h||h.length===0){const _=document.createElement("sl-alert");_.variant="neutral",_.open=!0,_.className="text-xs",_.textContent="Ничего не найдено",g.appendChild(_),Jo(d);return}for(const _ of h){const D=document.createElement("div");D.className="flex gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 text-slate-800";const W=document.createElement("div");W.className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100";const Y=document.createElement("img");Y.className="h-full w-full object-cover preview-cover",Y.alt=_.title||"Poster",Y.referrerPolicy="no-referrer",Y.onerror=()=>{if(Y.remove(),W.querySelector("[data-poster-fallback]"))return;const nt=document.createElement("div");nt.dataset.posterFallback="true",nt.className="flex h-full w-full items-center justify-center bg-slate-200 text-lg font-semibold text-slate-500",nt.textContent=(_.title||"?").trim().charAt(0).toUpperCase()||"?",W.appendChild(nt)},_.thumbUrl&&(Y.src=_.thumbUrl),Y.onclick=()=>ls(_.thumbUrl),W.appendChild(Y),D.appendChild(W);const F=document.createElement("div");F.className="flex min-w-0 flex-1 flex-col gap-2";const Z=document.createElement("div");Z.className="text-sm font-semibold text-slate-900 truncate";const ft=_.year?` (${_.year})`:"";if(Z.textContent=`${_.title||"Untitled"}${ft}`,F.appendChild(Z),_.summary){const nt=document.createElement("div");nt.className="text-xs text-slate-600 max-h-16 overflow-hidden",nt.textContent=_.summary,F.appendChild(nt)}const rt=document.createElement("div");rt.className="flex items-center justify-between gap-2";const Q=document.createElement("sl-tag");Q.setAttribute("size","small"),Q.setAttribute("variant","neutral"),Q.textContent="Plex match",rt.appendChild(Q);const bt=document.createElement("sl-button");bt.setAttribute("size","small"),bt.setAttribute("variant","primary"),bt.textContent="Use",bt.onclick=()=>{m==="movie"?(t("m_title").value=_.title||"",_.year&&(t("m_year").value=String(_.year)),A("m_title"),A("m_year"),C("m_status","ok","Selected")):(t("s_title").value=_.title||"",_.year&&(t("s_year").value=String(_.year)),A("s_title"),A("s_year"),C("s_status","ok","Selected")),It()},rt.appendChild(bt),F.appendChild(rt),D.appendChild(F),g.appendChild(D)}Jo(d)}async function oo(d,h,m,g=8){return await oe("/api/meta/search",{kind:d,title:h,year:m||void 0,limit:g})}async function Zo(d){var ft,rt,Q;const h=d==="movie",m=t(h?"m_title":"s_title"),g=t(h?"m_year":"s_year"),_=h?"m_preview_list":"s_preview_list",D=h?"m_status":"s_status",W=h?"m_ac":"s_ac",Y=((ft=m==null?void 0:m.value)==null?void 0:ft.trim())||"",F=((rt=g==null?void 0:g.value)==null?void 0:rt.trim())||"";if(!Y){C(D,"warn","Need title"),pt(W);return}C(D,"info","Searching...");const Z=await oo(d,Y,F,8);if(y(Z)){C(D,"warn","Session expired"),pt(W);return}if(!Z.ok){C(D,"error",`Error • HTTP ${Z.status}`),pt(W);return}pt(W),eo(_,((Q=Z.data)==null?void 0:Q.items)??[],d),C(D,"ok","Ready")}function Qo(d,h,m){const g=t(d);if(g.innerHTML="",!h||h.length===0){pt(d);return}g.classList.remove("hidden");for(const _ of h){const D=document.createElement("button");D.type="button",D.className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-100";const W=document.createElement("div");W.className="truncate flex-1 min-w-0";const Y=_.year?` (${_.year})`:"";if(W.textContent=`${_.title||"Untitled"}${Y}`,D.appendChild(W),_.type){const F=document.createElement("sl-tag");F.setAttribute("size","small"),F.setAttribute("variant","neutral"),F.textContent=_.type,D.appendChild(F)}D.onclick=()=>{m==="movie"?(t("m_title").value=_.title||"",_.year&&(t("m_year").value=String(_.year)),A("m_title"),A("m_year"),C("m_status","ok","Selected"),pt("m_ac"),eo("m_preview_list",[_],"movie")):(t("s_title").value=_.title||"",_.year&&(t("s_year").value=String(_.year)),A("s_title"),A("s_year"),C("s_status","ok","Selected"),pt("s_ac"),eo("s_preview_list",[_],"show")),It()},g.appendChild(D)}}t("m_run").onclick=async()=>{var m;if(!Le("movie")){Xo("movie"),It();return}const h=jo("m_save")?rs():null;x("m_status","info","Running...");try{const g=await Go("/api/link/movie",{src:t("m_src").value,title:t("m_title").value,year:t("m_year").value});if(y(g)){x("m_status","warn","Session expired");return}f(g.text);const _=((m=g.data)==null?void 0:m.code)!=null?` • exit ${g.data.code}`:"";g.ok?(x("m_status","ok",`OK • HTTP ${g.status}${_}`),$("ok","Movie linked",`HTTP ${g.status}${_}`)):(x("m_status","error",`Error • HTTP ${g.status}${_}`),$("error","Movie failed",`HTTP ${g.status}${_}`))}catch(g){console.error("Movie link request failed",g),x("m_status","error","Error • request failed"),$("error","Movie failed","Request error")}finally{h&&await xt(h)}},t("s_run").onclick=async()=>{var m;if(!Le("season")){Xo("season"),It();return}const h=jo("s_save")?ns():null;x("s_status","info","Running...");try{const g=await Go("/api/link/season",{srcDir:t("s_src").value,title:t("s_title").value,season:t("s_season").value,year:t("s_year").value});if(y(g)){x("s_status","warn","Session expired");return}f(g.text);const _=((m=g.data)==null?void 0:m.code)!=null?` • exit ${g.data.code}`:"";g.ok?(x("s_status","ok",`OK • HTTP ${g.status}${_}`),$("ok","Season linked",`HTTP ${g.status}${_}`)):(x("s_status","error",`Error • HTTP ${g.status}${_}`),$("error","Season failed",`HTTP ${g.status}${_}`))}catch(g){console.error("Season link request failed",g),x("s_status","error","Error • request failed"),$("error","Season failed","Request error")}finally{h&&await xt(h)}},t("browse").onclick=async()=>{var W,Y;const d=t("root"),h=(W=d==null?void 0:d.selectedOptions)==null?void 0:W[0],m=((Y=h==null?void 0:h.dataset)==null?void 0:Y.path)||i[d==null?void 0:d.value]||"";if(!m){f("Browse root is not selected");return}t("list").classList.add("hidden"),t("list_loading").classList.remove("hidden");const g=await oe("/api/list",{dir:m});if(t("list_loading").classList.add("hidden"),t("list").classList.remove("hidden"),y(g)){f("Session expired while listing folders");return}const _=g.data||{};if(!_.ok){f(_.stderr||"error");return}const D=t("list");D.innerHTML="";for(const F of _.items){const Z=document.createElement("li");Z.className="border-b border-slate-100 last:border-b-0 py-1.5 text-slate-800 min-w-0 overflow-hidden";const ft=document.createElement("sl-tooltip");ft.content=F.name,ft.setAttribute("placement","top");const rt=document.createElement("div");rt.className="flex w-full items-center gap-2 min-w-0 overflow-hidden";const Q=document.createElement("span");Q.className="truncate flex-1 min-w-0 max-w-full flex items-center gap-2";const bt=document.createElement("sl-icon");bt.setAttribute("name",F.type==="d"?"folder":"film"),bt.className=`${F.type==="d"?"text-amber-600":"text-slate-500"} flex-shrink-0`,Q.appendChild(bt);const nt=document.createElement("span");nt.className="truncate",nt.textContent=F.name,Q.appendChild(nt),rt.appendChild(Q);const Oe=document.createElement("div");Oe.className="ml-2 flex items-center gap-2 text-xs flex-shrink-0";const pe=document.createElement("sl-button");pe.setAttribute("size","small"),pe.setAttribute("variant","text");const io=document.createElement("sl-icon");io.setAttribute("name","clipboard"),io.className="text-emerald-600",pe.appendChild(io);const Kt=document.createElement("sl-tooltip");Kt.content="Copy path",Kt.setAttribute("trigger","manual"),Kt.hoist=!0,Kt.appendChild(pe),pe.onclick=async()=>{const ei=`${m}/${F.name}`;try{await navigator.clipboard.writeText(ei),z(Kt)}catch{V(ei)?z(Kt):f("Clipboard error")}},Oe.appendChild(Kt);const fe=document.createElement("sl-button");fe.setAttribute("size","small"),fe.setAttribute("variant","text");const so=document.createElement("sl-icon");so.setAttribute("name","box-arrow-in-right"),so.className="text-blue-600",fe.appendChild(so);const ro=document.createElement("sl-tooltip");ro.content="Fill inputs",ro.appendChild(fe),fe.onclick=()=>{F.type==="d"&&(t("m_src").value=`${m}/${F.name}`,t("s_src").value=`${m}/${F.name}`,A("m_src"),A("s_src"),It())},Oe.appendChild(ro),rt.appendChild(Oe),ft.appendChild(rt),Z.appendChild(ft),D.appendChild(Z)}},t("m_title").addEventListener("input",st),t("m_year").addEventListener("input",st),t("s_title").addEventListener("input",J),t("s_year").addEventListener("input",J),t("logout_btn").onclick=async()=>{const d=await oe("/api/session/logout",{});y(d)||window.location.replace("/")};for(const d of["m_src","m_title","m_year","s_src","s_title","s_season","s_year"]){const h=t(d);if(h)for(const m of["input","sl-input","sl-change","change"])h.addEventListener(m,It)}document.addEventListener("click",d=>{var g,_;const h=(g=t("m_ac"))==null?void 0:g.parentElement,m=(_=t("s_ac"))==null?void 0:_.parentElement;h&&!h.contains(d.target)&&pt("m_ac"),m&&!m.contains(d.target)&&pt("s_ac")}),to(),It(),t("root").value="torrents";function cs(){s=null,t("confirm_delete").hide()}async function ds(){s&&await Qe(s),s=null,t("confirm_delete").hide()}for(const d of["click","sl-click"])t("cancel_delete").addEventListener(d,cs),t("confirm_delete_btn").addEventListener(d,ds),t("session_reload").addEventListener(d,()=>window.location.reload());B()}us(()=>{hs(),ps()});function fs(t){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",t,{once:!0});return}t()}function bs(){const t=document.getElementById("login_form"),e=document.getElementById("login_submit"),o=document.getElementById("login_error");if(!t||!e||!o)return;function i(s){if(!s){o.textContent="",o.classList.remove("visible");return}o.textContent=s,o.classList.add("visible")}t.addEventListener("submit",async s=>{s.preventDefault(),i(""),e.disabled=!0;const r=document.getElementById("login_username").value.trim(),n=document.getElementById("login_password").value;try{const l=await fetch("/api/session/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:r,password:n})}),c=await l.json().catch(()=>({}));if(!l.ok||c.ok===!1){i(c.error||`HTTP ${l.status}`),e.disabled=!1;return}window.location.replace("/")}catch{i("Login request failed"),e.disabled=!1}})}fs(bs);/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Be=globalThis,So=Be.ShadowRoot&&(Be.ShadyCSS===void 0||Be.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Eo=Symbol(),oi=new WeakMap;let Di=class{constructor(e,o,i){if(this._$cssResult$=!0,i!==Eo)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=o}get styleSheet(){let e=this.o;const o=this.t;if(So&&e===void 0){const i=o!==void 0&&o.length===1;i&&(e=oi.get(o)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),i&&oi.set(o,e))}return e}toString(){return this.cssText}};const ms=t=>new Di(typeof t=="string"?t:t+"",void 0,Eo),G=(t,...e)=>{const o=t.length===1?t[0]:e.reduce((i,s,r)=>i+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[r+1],t[0]);return new Di(o,t,Eo)},gs=(t,e)=>{if(So)t.adoptedStyleSheets=e.map(o=>o instanceof CSSStyleSheet?o:o.styleSheet);else for(const o of e){const i=document.createElement("style"),s=Be.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=o.cssText,t.appendChild(i)}},ii=So?t=>t:t=>t instanceof CSSStyleSheet?(e=>{let o="";for(const i of e.cssRules)o+=i.cssText;return ms(o)})(t):t;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:vs,defineProperty:ys,getOwnPropertyDescriptor:_s,getOwnPropertyNames:ws,getOwnPropertySymbols:xs,getPrototypeOf:ks}=Object,Nt=globalThis,si=Nt.trustedTypes,Cs=si?si.emptyScript:"",no=Nt.reactiveElementPolyfillSupport,we=(t,e)=>t,ae={toAttribute(t,e){switch(e){case Boolean:t=t?Cs:null;break;case Object:case Array:t=t==null?t:JSON.stringify(t)}return t},fromAttribute(t,e){let o=t;switch(e){case Boolean:o=t!==null;break;case Number:o=t===null?null:Number(t);break;case Object:case Array:try{o=JSON.parse(t)}catch{o=null}}return o}},To=(t,e)=>!vs(t,e),ri={attribute:!0,type:String,converter:ae,reflect:!1,useDefault:!1,hasChanged:To};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),Nt.litPropertyMetadata??(Nt.litPropertyMetadata=new WeakMap);let se=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??(this.l=[])).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,o=ri){if(o.state&&(o.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((o=Object.create(o)).wrapped=!0),this.elementProperties.set(e,o),!o.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(e,i,o);s!==void 0&&ys(this.prototype,e,s)}}static getPropertyDescriptor(e,o,i){const{get:s,set:r}=_s(this.prototype,e)??{get(){return this[o]},set(n){this[o]=n}};return{get:s,set(n){const l=s==null?void 0:s.call(this);r==null||r.call(this,n),this.requestUpdate(e,l,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??ri}static _$Ei(){if(this.hasOwnProperty(we("elementProperties")))return;const e=ks(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(we("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(we("properties"))){const o=this.properties,i=[...ws(o),...xs(o)];for(const s of i)this.createProperty(s,o[s])}const e=this[Symbol.metadata];if(e!==null){const o=litPropertyMetadata.get(e);if(o!==void 0)for(const[i,s]of o)this.elementProperties.set(i,s)}this._$Eh=new Map;for(const[o,i]of this.elementProperties){const s=this._$Eu(o,i);s!==void 0&&this._$Eh.set(s,o)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const o=[];if(Array.isArray(e)){const i=new Set(e.flat(1/0).reverse());for(const s of i)o.unshift(ii(s))}else e!==void 0&&o.push(ii(e));return o}static _$Eu(e,o){const i=o.attribute;return i===!1?void 0:typeof i=="string"?i:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var e;this._$ES=new Promise(o=>this.enableUpdating=o),this._$AL=new Map,this._$E_(),this.requestUpdate(),(e=this.constructor.l)==null||e.forEach(o=>o(this))}addController(e){var o;(this._$EO??(this._$EO=new Set)).add(e),this.renderRoot!==void 0&&this.isConnected&&((o=e.hostConnected)==null||o.call(e))}removeController(e){var o;(o=this._$EO)==null||o.delete(e)}_$E_(){const e=new Map,o=this.constructor.elementProperties;for(const i of o.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return gs(e,this.constructor.elementStyles),e}connectedCallback(){var e;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(e=this._$EO)==null||e.forEach(o=>{var i;return(i=o.hostConnected)==null?void 0:i.call(o)})}enableUpdating(e){}disconnectedCallback(){var e;(e=this._$EO)==null||e.forEach(o=>{var i;return(i=o.hostDisconnected)==null?void 0:i.call(o)})}attributeChangedCallback(e,o,i){this._$AK(e,i)}_$ET(e,o){var r;const i=this.constructor.elementProperties.get(e),s=this.constructor._$Eu(e,i);if(s!==void 0&&i.reflect===!0){const n=(((r=i.converter)==null?void 0:r.toAttribute)!==void 0?i.converter:ae).toAttribute(o,i.type);this._$Em=e,n==null?this.removeAttribute(s):this.setAttribute(s,n),this._$Em=null}}_$AK(e,o){var r,n;const i=this.constructor,s=i._$Eh.get(e);if(s!==void 0&&this._$Em!==s){const l=i.getPropertyOptions(s),c=typeof l.converter=="function"?{fromAttribute:l.converter}:((r=l.converter)==null?void 0:r.fromAttribute)!==void 0?l.converter:ae;this._$Em=s;const p=c.fromAttribute(o,l.type);this[s]=p??((n=this._$Ej)==null?void 0:n.get(s))??p,this._$Em=null}}requestUpdate(e,o,i,s=!1,r){var n;if(e!==void 0){const l=this.constructor;if(s===!1&&(r=this[e]),i??(i=l.getPropertyOptions(e)),!((i.hasChanged??To)(r,o)||i.useDefault&&i.reflect&&r===((n=this._$Ej)==null?void 0:n.get(e))&&!this.hasAttribute(l._$Eu(e,i))))return;this.C(e,o,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,o,{useDefault:i,reflect:s,wrapped:r},n){i&&!(this._$Ej??(this._$Ej=new Map)).has(e)&&(this._$Ej.set(e,n??o??this[e]),r!==!0||n!==void 0)||(this._$AL.has(e)||(this.hasUpdated||i||(o=void 0),this._$AL.set(e,o)),s===!0&&this._$Em!==e&&(this._$Eq??(this._$Eq=new Set)).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(o){Promise.reject(o)}const e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var i;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[r,n]of this._$Ep)this[r]=n;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[r,n]of s){const{wrapped:l}=n,c=this[r];l!==!0||this._$AL.has(r)||c===void 0||this.C(r,void 0,n,c)}}let e=!1;const o=this._$AL;try{e=this.shouldUpdate(o),e?(this.willUpdate(o),(i=this._$EO)==null||i.forEach(s=>{var r;return(r=s.hostUpdate)==null?void 0:r.call(s)}),this.update(o)):this._$EM()}catch(s){throw e=!1,this._$EM(),s}e&&this._$AE(o)}willUpdate(e){}_$AE(e){var o;(o=this._$EO)==null||o.forEach(i=>{var s;return(s=i.hostUpdated)==null?void 0:s.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&(this._$Eq=this._$Eq.forEach(o=>this._$ET(o,this[o]))),this._$EM()}updated(e){}firstUpdated(e){}};se.elementStyles=[],se.shadowRootOptions={mode:"open"},se[we("elementProperties")]=new Map,se[we("finalized")]=new Map,no==null||no({ReactiveElement:se}),(Nt.reactiveElementVersions??(Nt.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const xe=globalThis,ni=t=>t,Me=xe.trustedTypes,ai=Me?Me.createPolicy("lit-html",{createHTML:t=>t}):void 0,Ri="$lit$",Mt=`lit$${Math.random().toFixed(9).slice(2)}$`,Bi="?"+Mt,$s=`<${Bi}>`,Qt=document,Ce=()=>Qt.createComment(""),$e=t=>t===null||typeof t!="object"&&typeof t!="function",zo=Array.isArray,As=t=>zo(t)||typeof(t==null?void 0:t[Symbol.iterator])=="function",ao=`[ 	
\f\r]`,be=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,li=/-->/g,ci=/>/g,Yt=RegExp(`>|${ao}(?:([^\\s"'>=/]+)(${ao}*=${ao}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),di=/'/g,ui=/"/g,Ii=/^(?:script|style|textarea|title)$/i,Ss=t=>(e,...o)=>({_$litType$:t,strings:e,values:o}),T=Ss(1),_t=Symbol.for("lit-noChange"),j=Symbol.for("lit-nothing"),hi=new WeakMap,Jt=Qt.createTreeWalker(Qt,129);function Fi(t,e){if(!zo(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return ai!==void 0?ai.createHTML(e):e}const Es=(t,e)=>{const o=t.length-1,i=[];let s,r=e===2?"<svg>":e===3?"<math>":"",n=be;for(let l=0;l<o;l++){const c=t[l];let p,b,f=-1,y=0;for(;y<c.length&&(n.lastIndex=y,b=n.exec(c),b!==null);)y=n.lastIndex,n===be?b[1]==="!--"?n=li:b[1]!==void 0?n=ci:b[2]!==void 0?(Ii.test(b[2])&&(s=RegExp("</"+b[2],"g")),n=Yt):b[3]!==void 0&&(n=Yt):n===Yt?b[0]===">"?(n=s??be,f=-1):b[1]===void 0?f=-2:(f=n.lastIndex-b[2].length,p=b[1],n=b[3]===void 0?Yt:b[3]==='"'?ui:di):n===ui||n===di?n=Yt:n===li||n===ci?n=be:(n=Yt,s=void 0);const v=n===Yt&&t[l+1].startsWith("/>")?" ":"";r+=n===be?c+$s:f>=0?(i.push(p),c.slice(0,f)+Ri+c.slice(f)+Mt+v):c+Mt+(f===-2?l:v)}return[Fi(t,r+(t[o]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),i]};class Ae{constructor({strings:e,_$litType$:o},i){let s;this.parts=[];let r=0,n=0;const l=e.length-1,c=this.parts,[p,b]=Es(e,o);if(this.el=Ae.createElement(p,i),Jt.currentNode=this.el.content,o===2||o===3){const f=this.el.content.firstChild;f.replaceWith(...f.childNodes)}for(;(s=Jt.nextNode())!==null&&c.length<l;){if(s.nodeType===1){if(s.hasAttributes())for(const f of s.getAttributeNames())if(f.endsWith(Ri)){const y=b[n++],v=s.getAttribute(f).split(Mt),w=/([.?@])?(.*)/.exec(y);c.push({type:1,index:r,name:w[2],strings:v,ctor:w[1]==="."?zs:w[1]==="?"?Ls:w[1]==="@"?Os:qe}),s.removeAttribute(f)}else f.startsWith(Mt)&&(c.push({type:6,index:r}),s.removeAttribute(f));if(Ii.test(s.tagName)){const f=s.textContent.split(Mt),y=f.length-1;if(y>0){s.textContent=Me?Me.emptyScript:"";for(let v=0;v<y;v++)s.append(f[v],Ce()),Jt.nextNode(),c.push({type:2,index:++r});s.append(f[y],Ce())}}}else if(s.nodeType===8)if(s.data===Bi)c.push({type:2,index:r});else{let f=-1;for(;(f=s.data.indexOf(Mt,f+1))!==-1;)c.push({type:7,index:r}),f+=Mt.length-1}r++}}static createElement(e,o){const i=Qt.createElement("template");return i.innerHTML=e,i}}function le(t,e,o=t,i){var n,l;if(e===_t)return e;let s=i!==void 0?(n=o._$Co)==null?void 0:n[i]:o._$Cl;const r=$e(e)?void 0:e._$litDirective$;return(s==null?void 0:s.constructor)!==r&&((l=s==null?void 0:s._$AO)==null||l.call(s,!1),r===void 0?s=void 0:(s=new r(t),s._$AT(t,o,i)),i!==void 0?(o._$Co??(o._$Co=[]))[i]=s:o._$Cl=s),s!==void 0&&(e=le(t,s._$AS(t,e.values),s,i)),e}class Ts{constructor(e,o){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=o}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:o},parts:i}=this._$AD,s=((e==null?void 0:e.creationScope)??Qt).importNode(o,!0);Jt.currentNode=s;let r=Jt.nextNode(),n=0,l=0,c=i[0];for(;c!==void 0;){if(n===c.index){let p;c.type===2?p=new Ee(r,r.nextSibling,this,e):c.type===1?p=new c.ctor(r,c.name,c.strings,this,e):c.type===6&&(p=new Ps(r,this,e)),this._$AV.push(p),c=i[++l]}n!==(c==null?void 0:c.index)&&(r=Jt.nextNode(),n++)}return Jt.currentNode=Qt,s}p(e){let o=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(e,i,o),o+=i.strings.length-2):i._$AI(e[o])),o++}}class Ee{get _$AU(){var e;return((e=this._$AM)==null?void 0:e._$AU)??this._$Cv}constructor(e,o,i,s){this.type=2,this._$AH=j,this._$AN=void 0,this._$AA=e,this._$AB=o,this._$AM=i,this.options=s,this._$Cv=(s==null?void 0:s.isConnected)??!0}get parentNode(){let e=this._$AA.parentNode;const o=this._$AM;return o!==void 0&&(e==null?void 0:e.nodeType)===11&&(e=o.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,o=this){e=le(this,e,o),$e(e)?e===j||e==null||e===""?(this._$AH!==j&&this._$AR(),this._$AH=j):e!==this._$AH&&e!==_t&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):As(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==j&&$e(this._$AH)?this._$AA.nextSibling.data=e:this.T(Qt.createTextNode(e)),this._$AH=e}$(e){var r;const{values:o,_$litType$:i}=e,s=typeof i=="number"?this._$AC(e):(i.el===void 0&&(i.el=Ae.createElement(Fi(i.h,i.h[0]),this.options)),i);if(((r=this._$AH)==null?void 0:r._$AD)===s)this._$AH.p(o);else{const n=new Ts(s,this),l=n.u(this.options);n.p(o),this.T(l),this._$AH=n}}_$AC(e){let o=hi.get(e.strings);return o===void 0&&hi.set(e.strings,o=new Ae(e)),o}k(e){zo(this._$AH)||(this._$AH=[],this._$AR());const o=this._$AH;let i,s=0;for(const r of e)s===o.length?o.push(i=new Ee(this.O(Ce()),this.O(Ce()),this,this.options)):i=o[s],i._$AI(r),s++;s<o.length&&(this._$AR(i&&i._$AB.nextSibling,s),o.length=s)}_$AR(e=this._$AA.nextSibling,o){var i;for((i=this._$AP)==null?void 0:i.call(this,!1,!0,o);e!==this._$AB;){const s=ni(e).nextSibling;ni(e).remove(),e=s}}setConnected(e){var o;this._$AM===void 0&&(this._$Cv=e,(o=this._$AP)==null||o.call(this,e))}}class qe{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,o,i,s,r){this.type=1,this._$AH=j,this._$AN=void 0,this.element=e,this.name=o,this._$AM=s,this.options=r,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=j}_$AI(e,o=this,i,s){const r=this.strings;let n=!1;if(r===void 0)e=le(this,e,o,0),n=!$e(e)||e!==this._$AH&&e!==_t,n&&(this._$AH=e);else{const l=e;let c,p;for(e=r[0],c=0;c<r.length-1;c++)p=le(this,l[i+c],o,c),p===_t&&(p=this._$AH[c]),n||(n=!$e(p)||p!==this._$AH[c]),p===j?e=j:e!==j&&(e+=(p??"")+r[c+1]),this._$AH[c]=p}n&&!s&&this.j(e)}j(e){e===j?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class zs extends qe{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===j?void 0:e}}class Ls extends qe{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==j)}}class Os extends qe{constructor(e,o,i,s,r){super(e,o,i,s,r),this.type=5}_$AI(e,o=this){if((e=le(this,e,o,0)??j)===_t)return;const i=this._$AH,s=e===j&&i!==j||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,r=e!==j&&(i===j||s);s&&this.element.removeEventListener(this.name,this,i),r&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){var o;typeof this._$AH=="function"?this._$AH.call(((o=this.options)==null?void 0:o.host)??this.element,e):this._$AH.handleEvent(e)}}class Ps{constructor(e,o,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=o,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){le(this,e)}}const lo=xe.litHtmlPolyfillSupport;lo==null||lo(Ae,Ee),(xe.litHtmlVersions??(xe.litHtmlVersions=[])).push("3.3.2");const Ds=(t,e,o)=>{const i=(o==null?void 0:o.renderBefore)??e;let s=i._$litPart$;if(s===void 0){const r=(o==null?void 0:o.renderBefore)??null;i._$litPart$=s=new Ee(e.insertBefore(Ce(),r),r,void 0,o??{})}return s._$AI(t),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Zt=globalThis;let ke=class extends se{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var o;const e=super.createRenderRoot();return(o=this.renderOptions).renderBefore??(o.renderBefore=e.firstChild),e}update(e){const o=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Ds(o,this.renderRoot,this.renderOptions)}connectedCallback(){var e;super.connectedCallback(),(e=this._$Do)==null||e.setConnected(!0)}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._$Do)==null||e.setConnected(!1)}render(){return _t}};var Pi;ke._$litElement$=!0,ke.finalized=!0,(Pi=Zt.litElementHydrateSupport)==null||Pi.call(Zt,{LitElement:ke});const co=Zt.litElementPolyfillSupport;co==null||co({LitElement:ke});(Zt.litElementVersions??(Zt.litElementVersions=[])).push("4.2.2");var Rs=G`
  :host {
    display: inline-block;
    color: var(--sl-color-neutral-600);
  }

  .icon-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--sl-border-radius-medium);
    font-size: inherit;
    color: inherit;
    padding: var(--sl-spacing-x-small);
    cursor: pointer;
    transition: var(--sl-transition-x-fast) color;
    -webkit-appearance: none;
  }

  .icon-button:hover:not(.icon-button--disabled),
  .icon-button:focus-visible:not(.icon-button--disabled) {
    color: var(--sl-color-primary-600);
  }

  .icon-button:active:not(.icon-button--disabled) {
    color: var(--sl-color-primary-700);
  }

  .icon-button:focus {
    outline: none;
  }

  .icon-button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-button:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .icon-button__icon {
    pointer-events: none;
  }
`,vo="";function pi(t){vo=t}function Bs(t=""){if(!vo){const e=[...document.getElementsByTagName("script")],o=e.find(i=>i.hasAttribute("data-shoelace"));if(o)pi(o.getAttribute("data-shoelace"));else{const i=e.find(r=>/shoelace(\.min)?\.js($|\?)/.test(r.src)||/shoelace-autoloader(\.min)?\.js($|\?)/.test(r.src));let s="";i&&(s=i.getAttribute("src")),pi(s.split("/").slice(0,-1).join("/"))}}return vo.replace(/\/$/,"")+(t?`/${t.replace(/^\//,"")}`:"")}var Is={name:"default",resolver:t=>Bs(`assets/icons/${t}.svg`)},Fs=Is,fi={caret:`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `,check:`
    <svg part="checked-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor">
          <g transform="translate(3.428571, 3.428571)">
            <path d="M0,5.71428571 L3.42857143,9.14285714"></path>
            <path d="M9.14285714,0 L3.42857143,9.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,"chevron-down":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-down" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,"chevron-left":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
    </svg>
  `,"chevron-right":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,copy:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-copy" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z"/>
    </svg>
  `,eye:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16">
      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
    </svg>
  `,"eye-slash":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-slash" viewBox="0 0 16 16">
      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
      <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
      <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
    </svg>
  `,eyedropper:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eyedropper" viewBox="0 0 16 16">
      <path d="M13.354.646a1.207 1.207 0 0 0-1.708 0L8.5 3.793l-.646-.647a.5.5 0 1 0-.708.708L8.293 5l-7.147 7.146A.5.5 0 0 0 1 12.5v1.793l-.854.853a.5.5 0 1 0 .708.707L1.707 15H3.5a.5.5 0 0 0 .354-.146L11 7.707l1.146 1.147a.5.5 0 0 0 .708-.708l-.647-.646 3.147-3.146a1.207 1.207 0 0 0 0-1.708l-2-2zM2 12.707l7-7L10.293 7l-7 7H2v-1.293z"></path>
    </svg>
  `,"grip-vertical":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16">
      <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"></path>
    </svg>
  `,indeterminate:`
    <svg part="indeterminate-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor" stroke-width="2">
          <g transform="translate(2.285714, 6.857143)">
            <path d="M10.2857143,1.14285714 L1.14285714,1.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,"person-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person-fill" viewBox="0 0 16 16">
      <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
    </svg>
  `,"play-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
      <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"></path>
    </svg>
  `,"pause-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"></path>
    </svg>
  `,radio:`
    <svg part="checked-icon" class="radio__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g fill="currentColor">
          <circle cx="8" cy="8" r="3.42857143"></circle>
        </g>
      </g>
    </svg>
  `,"star-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-star-fill" viewBox="0 0 16 16">
      <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
    </svg>
  `,"x-lg":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
      <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
    </svg>
  `,"x-circle-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle-fill" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
    </svg>
  `},Ms={name:"system",resolver:t=>t in fi?`data:image/svg+xml,${encodeURIComponent(fi[t])}`:""},Ns=Ms,Ne=[Fs,Ns],Ve=[];function Vs(t){Ve.push(t)}function Hs(t){Ve=Ve.filter(e=>e!==t)}function bi(t){return Ne.find(e=>e.name===t)}function Us(t,e){Ws(t),Ne.push({name:t,resolver:e.resolver,mutator:e.mutator,spriteSheet:e.spriteSheet}),Ve.forEach(o=>{o.library===t&&o.setIcon()})}function Ws(t){Ne=Ne.filter(e=>e.name!==t)}var js=G`
  :host {
    display: inline-block;
    width: 1em;
    height: 1em;
    box-sizing: content-box !important;
  }

  svg {
    display: block;
    height: 100%;
    width: 100%;
  }
`,Mi=Object.defineProperty,qs=Object.defineProperties,Ks=Object.getOwnPropertyDescriptor,Ys=Object.getOwnPropertyDescriptors,mi=Object.getOwnPropertySymbols,Xs=Object.prototype.hasOwnProperty,Gs=Object.prototype.propertyIsEnumerable,uo=(t,e)=>(e=Symbol[t])?e:Symbol.for("Symbol."+t),gi=(t,e,o)=>e in t?Mi(t,e,{enumerable:!0,configurable:!0,writable:!0,value:o}):t[e]=o,jt=(t,e)=>{for(var o in e||(e={}))Xs.call(e,o)&&gi(t,o,e[o]);if(mi)for(var o of mi(e))Gs.call(e,o)&&gi(t,o,e[o]);return t},Ke=(t,e)=>qs(t,Ys(e)),a=(t,e,o,i)=>{for(var s=i>1?void 0:i?Ks(e,o):e,r=t.length-1,n;r>=0;r--)(n=t[r])&&(s=(i?n(e,o,s):n(s))||s);return i&&s&&Mi(e,o,s),s},Js=function(t,e){this[0]=t,this[1]=e},Zs=t=>{var e=t[uo("asyncIterator")],o=!1,i,s={};return e==null?(e=t[uo("iterator")](),i=r=>s[r]=n=>e[r](n)):(e=e.call(t),i=r=>s[r]=n=>{if(o){if(o=!1,r==="throw")throw n;return n}return o=!0,{done:!1,value:new Js(new Promise(l=>{var c=e[r](n);if(!(c instanceof Object))throw TypeError("Object expected");l(c)}),1)}}),s[uo("iterator")]=()=>s,i("next"),"throw"in e?i("throw"):s.throw=r=>{throw r},"return"in e&&i("return"),s};function N(t,e){const o=jt({waitUntilFirstUpdate:!1},e);return(i,s)=>{const{update:r}=i,n=Array.isArray(t)?t:[t];i.update=function(l){n.forEach(c=>{const p=c;if(l.has(p)){const b=l.get(p),f=this[p];b!==f&&(!o.waitUntilFirstUpdate||this.hasUpdated)&&this[s](b,f)}}),r.call(this,l)}}}var tt=G`
  :host {
    box-sizing: border-box;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: inherit;
  }

  [hidden] {
    display: none !important;
  }
`;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Qs={attribute:!0,type:String,converter:ae,reflect:!1,hasChanged:To},tr=(t=Qs,e,o)=>{const{kind:i,metadata:s}=o;let r=globalThis.litPropertyMetadata.get(s);if(r===void 0&&globalThis.litPropertyMetadata.set(s,r=new Map),i==="setter"&&((t=Object.create(t)).wrapped=!0),r.set(o.name,t),i==="accessor"){const{name:n}=o;return{set(l){const c=e.get.call(this);e.set.call(this,l),this.requestUpdate(n,c,t,!0,l)},init(l){return l!==void 0&&this.C(n,void 0,t,l),l}}}if(i==="setter"){const{name:n}=o;return function(l){const c=this[n];e.call(this,l),this.requestUpdate(n,c,t,!0,l)}}throw Error("Unsupported decorator location: "+i)};function u(t){return(e,o)=>typeof o=="object"?tr(t,e,o):((i,s,r)=>{const n=s.hasOwnProperty(r);return s.constructor.createProperty(r,i),n?Object.getOwnPropertyDescriptor(s,r):void 0})(t,e,o)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function dt(t){return u({...t,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const er=(t,e,o)=>(o.configurable=!0,o.enumerable=!0,Reflect.decorate&&typeof e!="object"&&Object.defineProperty(t,e,o),o);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function H(t,e){return(o,i,s)=>{const r=n=>{var l;return((l=n.renderRoot)==null?void 0:l.querySelector(t))??null};return er(o,i,{get(){return r(this)}})}}var q=class extends ke{constructor(){super(),Object.entries(this.constructor.dependencies).forEach(([t,e])=>{this.constructor.define(t,e)})}emit(t,e){const o=new CustomEvent(t,jt({bubbles:!0,cancelable:!1,composed:!0,detail:{}},e));return this.dispatchEvent(o),o}static define(t,e=this,o={}){const i=customElements.get(t);if(!i){customElements.define(t,class extends e{},o);return}let s=" (unknown version)",r=s;"version"in e&&e.version&&(s=" v"+e.version),"version"in i&&i.version&&(r=" v"+i.version),!(s&&r&&s===r)&&console.warn(`Attempted to register <${t}>${s}, but <${t}>${r} has already been registered.`)}};q.version="2.15.0";q.dependencies={};a([u()],q.prototype,"dir",2);a([u()],q.prototype,"lang",2);/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const or=(t,e)=>(t==null?void 0:t._$litType$)!==void 0,ir=t=>t.strings===void 0,sr={},rr=(t,e=sr)=>t._$AH=e;var me=Symbol(),Pe=Symbol(),ho,po=new Map,lt=class extends q{constructor(){super(...arguments),this.initialRender=!1,this.svg=null,this.label="",this.library="default"}async resolveIcon(t,e){var o;let i;if(e!=null&&e.spriteSheet){this.svg=T`<svg part="svg">
        <use part="use" href="${t}"></use>
      </svg>`,await this.updateComplete;const s=this.shadowRoot.querySelector("[part='svg']");return typeof e.mutator=="function"&&e.mutator(s),this.svg}try{if(i=await fetch(t,{mode:"cors"}),!i.ok)return i.status===410?me:Pe}catch{return Pe}try{const s=document.createElement("div");s.innerHTML=await i.text();const r=s.firstElementChild;if(((o=r==null?void 0:r.tagName)==null?void 0:o.toLowerCase())!=="svg")return me;ho||(ho=new DOMParser);const l=ho.parseFromString(r.outerHTML,"text/html").body.querySelector("svg");return l?(l.part.add("svg"),document.adoptNode(l)):me}catch{return me}}connectedCallback(){super.connectedCallback(),Vs(this)}firstUpdated(){this.initialRender=!0,this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),Hs(this)}getIconSource(){const t=bi(this.library);return this.name&&t?{url:t.resolver(this.name),fromLibrary:!0}:{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){var t;const{url:e,fromLibrary:o}=this.getIconSource(),i=o?bi(this.library):void 0;if(!e){this.svg=null;return}let s=po.get(e);if(s||(s=this.resolveIcon(e,i),po.set(e,s)),!this.initialRender)return;const r=await s;if(r===Pe&&po.delete(e),e===this.getIconSource().url){if(or(r)){this.svg=r;return}switch(r){case Pe:case me:this.svg=null,this.emit("sl-error");break;default:this.svg=r.cloneNode(!0),(t=i==null?void 0:i.mutator)==null||t.call(i,this.svg),this.emit("sl-load")}}}render(){return this.svg}};lt.styles=[tt,js];a([dt()],lt.prototype,"svg",2);a([u({reflect:!0})],lt.prototype,"name",2);a([u()],lt.prototype,"src",2);a([u()],lt.prototype,"label",2);a([u({reflect:!0})],lt.prototype,"library",2);a([N("label")],lt.prototype,"handleLabelChange",1);a([N(["name","src","library"])],lt.prototype,"setIcon",1);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ft={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4},Lo=t=>(...e)=>({_$litDirective$:t,values:e});let Oo=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,o,i){this._$Ct=e,this._$AM=o,this._$Ci=i}_$AS(e,o){return this.update(e,o)}update(e,o){return this.render(...o)}};/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const X=Lo(class extends Oo{constructor(t){var e;if(super(t),t.type!==Ft.ATTRIBUTE||t.name!=="class"||((e=t.strings)==null?void 0:e.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(t){return" "+Object.keys(t).filter(e=>t[e]).join(" ")+" "}update(t,[e]){var i,s;if(this.st===void 0){this.st=new Set,t.strings!==void 0&&(this.nt=new Set(t.strings.join(" ").split(/\s/).filter(r=>r!=="")));for(const r in e)e[r]&&!((i=this.nt)!=null&&i.has(r))&&this.st.add(r);return this.render(e)}const o=t.element.classList;for(const r of this.st)r in e||(o.remove(r),this.st.delete(r));for(const r in e){const n=!!e[r];n===this.st.has(r)||(s=this.nt)!=null&&s.has(r)||(n?(o.add(r),this.st.add(r)):(o.remove(r),this.st.delete(r)))}return _t}});/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ni=Symbol.for(""),nr=t=>{if((t==null?void 0:t.r)===Ni)return t==null?void 0:t._$litStatic$},He=(t,...e)=>({_$litStatic$:e.reduce((o,i,s)=>o+(r=>{if(r._$litStatic$!==void 0)return r._$litStatic$;throw Error(`Value passed to 'literal' function must be a 'literal' result: ${r}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`)})(i)+t[s+1],t[0]),r:Ni}),vi=new Map,ar=t=>(e,...o)=>{const i=o.length;let s,r;const n=[],l=[];let c,p=0,b=!1;for(;p<i;){for(c=e[p];p<i&&(r=o[p],(s=nr(r))!==void 0);)c+=s+e[++p],b=!0;p!==i&&l.push(r),n.push(c),p++}if(p===i&&n.push(e[i]),b){const f=n.join("$$lit$$");(e=vi.get(f))===void 0&&(n.raw=n,vi.set(f,e=n)),o=l}return t(e,...o)},Ie=ar(T);/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const L=t=>t??j;var ot=class extends q{constructor(){super(...arguments),this.hasFocus=!1,this.label="",this.disabled=!1}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(t){this.disabled&&(t.preventDefault(),t.stopPropagation())}click(){this.button.click()}focus(t){this.button.focus(t)}blur(){this.button.blur()}render(){const t=!!this.href,e=t?He`a`:He`button`;return Ie`
      <${e}
        part="base"
        class=${X({"icon-button":!0,"icon-button--disabled":!t&&this.disabled,"icon-button--focused":this.hasFocus})}
        ?disabled=${L(t?void 0:this.disabled)}
        type=${L(t?void 0:"button")}
        href=${L(t?this.href:void 0)}
        target=${L(t?this.target:void 0)}
        download=${L(t?this.download:void 0)}
        rel=${L(t&&this.target?"noreferrer noopener":void 0)}
        role=${L(t?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        aria-label="${this.label}"
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @click=${this.handleClick}
      >
        <sl-icon
          class="icon-button__icon"
          name=${L(this.name)}
          library=${L(this.library)}
          src=${L(this.src)}
          aria-hidden="true"
        ></sl-icon>
      </${e}>
    `}};ot.styles=[tt,Rs];ot.dependencies={"sl-icon":lt};a([H(".icon-button")],ot.prototype,"button",2);a([dt()],ot.prototype,"hasFocus",2);a([u()],ot.prototype,"name",2);a([u()],ot.prototype,"library",2);a([u()],ot.prototype,"src",2);a([u()],ot.prototype,"href",2);a([u()],ot.prototype,"target",2);a([u()],ot.prototype,"download",2);a([u()],ot.prototype,"label",2);a([u({type:Boolean,reflect:!0})],ot.prototype,"disabled",2);var Vi=new Map,lr=new WeakMap;function cr(t){return t??{keyframes:[],options:{duration:0}}}function yi(t,e){return e.toLowerCase()==="rtl"?{keyframes:t.rtlKeyframes||t.keyframes,options:t.options}:t}function St(t,e){Vi.set(t,cr(e))}function kt(t,e,o){const i=lr.get(t);if(i!=null&&i[e])return yi(i[e],o.dir);const s=Vi.get(e);return s?yi(s,o.dir):{keyframes:[],options:{duration:0}}}function Vt(t,e){return new Promise(o=>{function i(s){s.target===t&&(t.removeEventListener(e,i),o())}t.addEventListener(e,i)})}function Ct(t,e,o){return new Promise(i=>{if((o==null?void 0:o.duration)===1/0)throw new Error("Promise-based animations must be finite.");const s=t.animate(e,Ke(jt({},o),{duration:dr()?0:o.duration}));s.addEventListener("cancel",i,{once:!0}),s.addEventListener("finish",i,{once:!0})})}function _i(t){return t=t.toString().toLowerCase(),t.indexOf("ms")>-1?parseFloat(t):t.indexOf("s")>-1?parseFloat(t)*1e3:parseFloat(t)}function dr(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}function Tt(t){return Promise.all(t.getAnimations().map(e=>new Promise(o=>{e.cancel(),requestAnimationFrame(o)})))}const yo=new Set,re=new Map;let Gt,Po="ltr",Do="en";const Hi=typeof MutationObserver<"u"&&typeof document<"u"&&typeof document.documentElement<"u";if(Hi){const t=new MutationObserver(Wi);Po=document.documentElement.dir||"ltr",Do=document.documentElement.lang||navigator.language,t.observe(document.documentElement,{attributes:!0,attributeFilter:["dir","lang"]})}function Ui(...t){t.map(e=>{const o=e.$code.toLowerCase();re.has(o)?re.set(o,Object.assign(Object.assign({},re.get(o)),e)):re.set(o,e),Gt||(Gt=e)}),Wi()}function Wi(){Hi&&(Po=document.documentElement.dir||"ltr",Do=document.documentElement.lang||navigator.language),[...yo.keys()].map(t=>{typeof t.requestUpdate=="function"&&t.requestUpdate()})}let ur=class{constructor(e){this.host=e,this.host.addController(this)}hostConnected(){yo.add(this.host)}hostDisconnected(){yo.delete(this.host)}dir(){return`${this.host.dir||Po}`.toLowerCase()}lang(){return`${this.host.lang||Do}`.toLowerCase()}getTranslationData(e){var o,i;const s=new Intl.Locale(e.replace(/_/g,"-")),r=s==null?void 0:s.language.toLowerCase(),n=(i=(o=s==null?void 0:s.region)===null||o===void 0?void 0:o.toLowerCase())!==null&&i!==void 0?i:"",l=re.get(`${r}-${n}`),c=re.get(r);return{locale:s,language:r,region:n,primary:l,secondary:c}}exists(e,o){var i;const{primary:s,secondary:r}=this.getTranslationData((i=o.lang)!==null&&i!==void 0?i:this.lang());return o=Object.assign({includeFallback:!1},o),!!(s&&s[e]||r&&r[e]||o.includeFallback&&Gt&&Gt[e])}term(e,...o){const{primary:i,secondary:s}=this.getTranslationData(this.lang());let r;if(i&&i[e])r=i[e];else if(s&&s[e])r=s[e];else if(Gt&&Gt[e])r=Gt[e];else return console.error(`No translation found for: ${String(e)}`),String(e);return typeof r=="function"?r(...o):r}date(e,o){return e=new Date(e),new Intl.DateTimeFormat(this.lang(),o).format(e)}number(e,o){return e=Number(e),isNaN(e)?"":new Intl.NumberFormat(this.lang(),o).format(e)}relativeTime(e,o,i){return new Intl.RelativeTimeFormat(this.lang(),i).format(e,o)}};var ji={$code:"en",$name:"English",$dir:"ltr",carousel:"Carousel",clearEntry:"Clear entry",close:"Close",copied:"Copied",copy:"Copy",currentValue:"Current value",error:"Error",goToSlide:(t,e)=>`Go to slide ${t} of ${e}`,hidePassword:"Hide password",loading:"Loading",nextSlide:"Next slide",numOptionsSelected:t=>t===0?"No options selected":t===1?"1 option selected":`${t} options selected`,previousSlide:"Previous slide",progress:"Progress",remove:"Remove",resize:"Resize",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",selectAColorFromTheScreen:"Select a color from the screen",showPassword:"Show password",slideNum:t=>`Slide ${t}`,toggleColorFormat:"Toggle color format"};Ui(ji);var hr=ji,Et=class extends ur{};Ui(hr);var ee=class{constructor(t,...e){this.slotNames=[],this.handleSlotChange=o=>{const i=o.target;(this.slotNames.includes("[default]")&&!i.name||i.name&&this.slotNames.includes(i.name))&&this.host.requestUpdate()},(this.host=t).addController(this),this.slotNames=e}hasDefaultSlot(){return[...this.host.childNodes].some(t=>{if(t.nodeType===t.TEXT_NODE&&t.textContent.trim()!=="")return!0;if(t.nodeType===t.ELEMENT_NODE){const e=t;if(e.tagName.toLowerCase()==="sl-visually-hidden")return!1;if(!e.hasAttribute("slot"))return!0}return!1})}hasNamedSlot(t){return this.host.querySelector(`:scope > [slot="${t}"]`)!==null}test(t){return t==="[default]"?this.hasDefaultSlot():this.hasNamedSlot(t)}hostConnected(){this.host.shadowRoot.addEventListener("slotchange",this.handleSlotChange)}hostDisconnected(){this.host.shadowRoot.removeEventListener("slotchange",this.handleSlotChange)}},pr=G`
  :host {
    display: contents;

    /* For better DX, we'll reset the margin here so the base part can inherit it */
    margin: 0;
  }

  .alert {
    position: relative;
    display: flex;
    align-items: stretch;
    background-color: var(--sl-panel-background-color);
    border: solid var(--sl-panel-border-width) var(--sl-panel-border-color);
    border-top-width: calc(var(--sl-panel-border-width) * 3);
    border-radius: var(--sl-border-radius-medium);
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-small);
    font-weight: var(--sl-font-weight-normal);
    line-height: 1.6;
    color: var(--sl-color-neutral-700);
    margin: inherit;
  }

  .alert:not(.alert--has-icon) .alert__icon,
  .alert:not(.alert--closable) .alert__close-button {
    display: none;
  }

  .alert__icon {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    font-size: var(--sl-font-size-large);
    padding-inline-start: var(--sl-spacing-large);
  }

  .alert--primary {
    border-top-color: var(--sl-color-primary-600);
  }

  .alert--primary .alert__icon {
    color: var(--sl-color-primary-600);
  }

  .alert--success {
    border-top-color: var(--sl-color-success-600);
  }

  .alert--success .alert__icon {
    color: var(--sl-color-success-600);
  }

  .alert--neutral {
    border-top-color: var(--sl-color-neutral-600);
  }

  .alert--neutral .alert__icon {
    color: var(--sl-color-neutral-600);
  }

  .alert--warning {
    border-top-color: var(--sl-color-warning-600);
  }

  .alert--warning .alert__icon {
    color: var(--sl-color-warning-600);
  }

  .alert--danger {
    border-top-color: var(--sl-color-danger-600);
  }

  .alert--danger .alert__icon {
    color: var(--sl-color-danger-600);
  }

  .alert__message {
    flex: 1 1 auto;
    display: block;
    padding: var(--sl-spacing-large);
    overflow: hidden;
  }

  .alert__close-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    font-size: var(--sl-font-size-medium);
    padding-inline-end: var(--sl-spacing-medium);
  }
`,ie=Object.assign(document.createElement("div"),{className:"sl-toast-stack"}),Lt=class extends q{constructor(){super(...arguments),this.hasSlotController=new ee(this,"icon","suffix"),this.localize=new Et(this),this.open=!1,this.closable=!1,this.variant="primary",this.duration=1/0}firstUpdated(){this.base.hidden=!this.open}restartAutoHide(){clearTimeout(this.autoHideTimeout),this.open&&this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.duration))}handleCloseClick(){this.hide()}handleMouseMove(){this.restartAutoHide()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.duration<1/0&&this.restartAutoHide(),await Tt(this.base),this.base.hidden=!1;const{keyframes:t,options:e}=kt(this,"alert.show",{dir:this.localize.dir()});await Ct(this.base,t,e),this.emit("sl-after-show")}else{this.emit("sl-hide"),clearTimeout(this.autoHideTimeout),await Tt(this.base);const{keyframes:t,options:e}=kt(this,"alert.hide",{dir:this.localize.dir()});await Ct(this.base,t,e),this.base.hidden=!0,this.emit("sl-after-hide")}}handleDurationChange(){this.restartAutoHide()}async show(){if(!this.open)return this.open=!0,Vt(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Vt(this,"sl-after-hide")}async toast(){return new Promise(t=>{ie.parentElement===null&&document.body.append(ie),ie.appendChild(this),requestAnimationFrame(()=>{this.clientWidth,this.show()}),this.addEventListener("sl-after-hide",()=>{ie.removeChild(this),t(),ie.querySelector("sl-alert")===null&&ie.remove()},{once:!0})})}render(){return T`
      <div
        part="base"
        class=${X({alert:!0,"alert--open":this.open,"alert--closable":this.closable,"alert--has-icon":this.hasSlotController.test("icon"),"alert--primary":this.variant==="primary","alert--success":this.variant==="success","alert--neutral":this.variant==="neutral","alert--warning":this.variant==="warning","alert--danger":this.variant==="danger"})}
        role="alert"
        aria-hidden=${this.open?"false":"true"}
        @mousemove=${this.handleMouseMove}
      >
        <div part="icon" class="alert__icon">
          <slot name="icon"></slot>
        </div>

        <div part="message" class="alert__message" aria-live="polite">
          <slot></slot>
        </div>

        ${this.closable?T`
              <sl-icon-button
                part="close-button"
                exportparts="base:close-button__base"
                class="alert__close-button"
                name="x-lg"
                library="system"
                label=${this.localize.term("close")}
                @click=${this.handleCloseClick}
              ></sl-icon-button>
            `:""}
      </div>
    `}};Lt.styles=[tt,pr];Lt.dependencies={"sl-icon-button":ot};a([H('[part~="base"]')],Lt.prototype,"base",2);a([u({type:Boolean,reflect:!0})],Lt.prototype,"open",2);a([u({type:Boolean,reflect:!0})],Lt.prototype,"closable",2);a([u({reflect:!0})],Lt.prototype,"variant",2);a([u({type:Number})],Lt.prototype,"duration",2);a([N("open",{waitUntilFirstUpdate:!0})],Lt.prototype,"handleOpenChange",1);a([N("duration")],Lt.prototype,"handleDurationChange",1);St("alert.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:250,easing:"ease"}});St("alert.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:250,easing:"ease"}});Lt.define("sl-alert");var fr=G`
  :host {
    --track-width: 2px;
    --track-color: rgb(128 128 128 / 25%);
    --indicator-color: var(--sl-color-primary-600);
    --speed: 2s;

    display: inline-flex;
    width: 1em;
    height: 1em;
    flex: none;
  }

  .spinner {
    flex: 1 1 auto;
    height: 100%;
    width: 100%;
  }

  .spinner__track,
  .spinner__indicator {
    fill: none;
    stroke-width: var(--track-width);
    r: calc(0.5em - var(--track-width) / 2);
    cx: 0.5em;
    cy: 0.5em;
    transform-origin: 50% 50%;
  }

  .spinner__track {
    stroke: var(--track-color);
    transform-origin: 0% 0%;
  }

  .spinner__indicator {
    stroke: var(--indicator-color);
    stroke-linecap: round;
    stroke-dasharray: 150% 75%;
    animation: spin var(--speed) linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
      stroke-dasharray: 0.05em, 3em;
    }

    50% {
      transform: rotate(450deg);
      stroke-dasharray: 1.375em, 1.375em;
    }

    100% {
      transform: rotate(1080deg);
      stroke-dasharray: 0.05em, 3em;
    }
  }
`,qi=class extends q{constructor(){super(...arguments),this.localize=new Et(this)}render(){return T`
      <svg part="base" class="spinner" role="progressbar" aria-label=${this.localize.term("loading")}>
        <circle class="spinner__track"></circle>
        <circle class="spinner__indicator"></circle>
      </svg>
    `}};qi.styles=[tt,fr];var ge=new WeakMap,ve=new WeakMap,ye=new WeakMap,fo=new WeakSet,De=new WeakMap,Ye=class{constructor(t,e){this.handleFormData=o=>{const i=this.options.disabled(this.host),s=this.options.name(this.host),r=this.options.value(this.host),n=this.host.tagName.toLowerCase()==="sl-button";this.host.isConnected&&!i&&!n&&typeof s=="string"&&s.length>0&&typeof r<"u"&&(Array.isArray(r)?r.forEach(l=>{o.formData.append(s,l.toString())}):o.formData.append(s,r.toString()))},this.handleFormSubmit=o=>{var i;const s=this.options.disabled(this.host),r=this.options.reportValidity;this.form&&!this.form.noValidate&&((i=ge.get(this.form))==null||i.forEach(n=>{this.setUserInteracted(n,!0)})),this.form&&!this.form.noValidate&&!s&&!r(this.host)&&(o.preventDefault(),o.stopImmediatePropagation())},this.handleFormReset=()=>{this.options.setValue(this.host,this.options.defaultValue(this.host)),this.setUserInteracted(this.host,!1),De.set(this.host,[])},this.handleInteraction=o=>{const i=De.get(this.host);i.includes(o.type)||i.push(o.type),i.length===this.options.assumeInteractionOn.length&&this.setUserInteracted(this.host,!0)},this.checkFormValidity=()=>{if(this.form&&!this.form.noValidate){const o=this.form.querySelectorAll("*");for(const i of o)if(typeof i.checkValidity=="function"&&!i.checkValidity())return!1}return!0},this.reportFormValidity=()=>{if(this.form&&!this.form.noValidate){const o=this.form.querySelectorAll("*");for(const i of o)if(typeof i.reportValidity=="function"&&!i.reportValidity())return!1}return!0},(this.host=t).addController(this),this.options=jt({form:o=>{const i=o.form;if(i){const r=o.getRootNode().querySelector(`#${i}`);if(r)return r}return o.closest("form")},name:o=>o.name,value:o=>o.value,defaultValue:o=>o.defaultValue,disabled:o=>{var i;return(i=o.disabled)!=null?i:!1},reportValidity:o=>typeof o.reportValidity=="function"?o.reportValidity():!0,checkValidity:o=>typeof o.checkValidity=="function"?o.checkValidity():!0,setValue:(o,i)=>o.value=i,assumeInteractionOn:["sl-input"]},e)}hostConnected(){const t=this.options.form(this.host);t&&this.attachForm(t),De.set(this.host,[]),this.options.assumeInteractionOn.forEach(e=>{this.host.addEventListener(e,this.handleInteraction)})}hostDisconnected(){this.detachForm(),De.delete(this.host),this.options.assumeInteractionOn.forEach(t=>{this.host.removeEventListener(t,this.handleInteraction)})}hostUpdated(){const t=this.options.form(this.host);t||this.detachForm(),t&&this.form!==t&&(this.detachForm(),this.attachForm(t)),this.host.hasUpdated&&this.setValidity(this.host.validity.valid)}attachForm(t){t?(this.form=t,ge.has(this.form)?ge.get(this.form).add(this.host):ge.set(this.form,new Set([this.host])),this.form.addEventListener("formdata",this.handleFormData),this.form.addEventListener("submit",this.handleFormSubmit),this.form.addEventListener("reset",this.handleFormReset),ve.has(this.form)||(ve.set(this.form,this.form.reportValidity),this.form.reportValidity=()=>this.reportFormValidity()),ye.has(this.form)||(ye.set(this.form,this.form.checkValidity),this.form.checkValidity=()=>this.checkFormValidity())):this.form=void 0}detachForm(){if(!this.form)return;const t=ge.get(this.form);t&&(t.delete(this.host),t.size<=0&&(this.form.removeEventListener("formdata",this.handleFormData),this.form.removeEventListener("submit",this.handleFormSubmit),this.form.removeEventListener("reset",this.handleFormReset),ve.has(this.form)&&(this.form.reportValidity=ve.get(this.form),ve.delete(this.form)),ye.has(this.form)&&(this.form.checkValidity=ye.get(this.form),ye.delete(this.form)),this.form=void 0))}setUserInteracted(t,e){e?fo.add(t):fo.delete(t),t.requestUpdate()}doAction(t,e){if(this.form){const o=document.createElement("button");o.type=t,o.style.position="absolute",o.style.width="0",o.style.height="0",o.style.clipPath="inset(50%)",o.style.overflow="hidden",o.style.whiteSpace="nowrap",e&&(o.name=e.name,o.value=e.value,["formaction","formenctype","formmethod","formnovalidate","formtarget"].forEach(i=>{e.hasAttribute(i)&&o.setAttribute(i,e.getAttribute(i))})),this.form.append(o),o.click(),o.remove()}}getForm(){var t;return(t=this.form)!=null?t:null}reset(t){this.doAction("reset",t)}submit(t){this.doAction("submit",t)}setValidity(t){const e=this.host,o=!!fo.has(e),i=!!e.required;e.toggleAttribute("data-required",i),e.toggleAttribute("data-optional",!i),e.toggleAttribute("data-invalid",!t),e.toggleAttribute("data-valid",t),e.toggleAttribute("data-user-invalid",!t&&o),e.toggleAttribute("data-user-valid",t&&o)}updateValidity(){const t=this.host;this.setValidity(t.validity.valid)}emitInvalidEvent(t){const e=new CustomEvent("sl-invalid",{bubbles:!1,composed:!1,cancelable:!0,detail:{}});t||e.preventDefault(),this.host.dispatchEvent(e)||t==null||t.preventDefault()}},Ro=Object.freeze({badInput:!1,customError:!1,patternMismatch:!1,rangeOverflow:!1,rangeUnderflow:!1,stepMismatch:!1,tooLong:!1,tooShort:!1,typeMismatch:!1,valid:!0,valueMissing:!1});Object.freeze(Ke(jt({},Ro),{valid:!1,valueMissing:!0}));Object.freeze(Ke(jt({},Ro),{valid:!1,customError:!0}));var br=G`
  :host {
    display: inline-block;
    position: relative;
    width: auto;
    cursor: pointer;
  }

  .button {
    display: inline-flex;
    align-items: stretch;
    justify-content: center;
    width: 100%;
    border-style: solid;
    border-width: var(--sl-input-border-width);
    font-family: var(--sl-input-font-family);
    font-weight: var(--sl-font-weight-semibold);
    text-decoration: none;
    user-select: none;
    -webkit-user-select: none;
    white-space: nowrap;
    vertical-align: middle;
    padding: 0;
    transition:
      var(--sl-transition-x-fast) background-color,
      var(--sl-transition-x-fast) color,
      var(--sl-transition-x-fast) border,
      var(--sl-transition-x-fast) box-shadow;
    cursor: inherit;
  }

  .button::-moz-focus-inner {
    border: 0;
  }

  .button:focus {
    outline: none;
  }

  .button:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* When disabled, prevent mouse events from bubbling up from children */
  .button--disabled * {
    pointer-events: none;
  }

  .button__prefix,
  .button__suffix {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  .button__label {
    display: inline-block;
  }

  .button__label::slotted(sl-icon) {
    vertical-align: -2px;
  }

  /*
   * Standard buttons
   */

  /* Default */
  .button--standard.button--default {
    background-color: var(--sl-color-neutral-0);
    border-color: var(--sl-color-neutral-300);
    color: var(--sl-color-neutral-700);
  }

  .button--standard.button--default:hover:not(.button--disabled) {
    background-color: var(--sl-color-primary-50);
    border-color: var(--sl-color-primary-300);
    color: var(--sl-color-primary-700);
  }

  .button--standard.button--default:active:not(.button--disabled) {
    background-color: var(--sl-color-primary-100);
    border-color: var(--sl-color-primary-400);
    color: var(--sl-color-primary-700);
  }

  /* Primary */
  .button--standard.button--primary {
    background-color: var(--sl-color-primary-600);
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--primary:hover:not(.button--disabled) {
    background-color: var(--sl-color-primary-500);
    border-color: var(--sl-color-primary-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--primary:active:not(.button--disabled) {
    background-color: var(--sl-color-primary-600);
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  /* Success */
  .button--standard.button--success {
    background-color: var(--sl-color-success-600);
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--success:hover:not(.button--disabled) {
    background-color: var(--sl-color-success-500);
    border-color: var(--sl-color-success-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--success:active:not(.button--disabled) {
    background-color: var(--sl-color-success-600);
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  /* Neutral */
  .button--standard.button--neutral {
    background-color: var(--sl-color-neutral-600);
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--neutral:hover:not(.button--disabled) {
    background-color: var(--sl-color-neutral-500);
    border-color: var(--sl-color-neutral-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--neutral:active:not(.button--disabled) {
    background-color: var(--sl-color-neutral-600);
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  /* Warning */
  .button--standard.button--warning {
    background-color: var(--sl-color-warning-600);
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }
  .button--standard.button--warning:hover:not(.button--disabled) {
    background-color: var(--sl-color-warning-500);
    border-color: var(--sl-color-warning-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--warning:active:not(.button--disabled) {
    background-color: var(--sl-color-warning-600);
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }

  /* Danger */
  .button--standard.button--danger {
    background-color: var(--sl-color-danger-600);
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--danger:hover:not(.button--disabled) {
    background-color: var(--sl-color-danger-500);
    border-color: var(--sl-color-danger-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--danger:active:not(.button--disabled) {
    background-color: var(--sl-color-danger-600);
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  /*
   * Outline buttons
   */

  .button--outline {
    background: none;
    border: solid 1px;
  }

  /* Default */
  .button--outline.button--default {
    border-color: var(--sl-color-neutral-300);
    color: var(--sl-color-neutral-700);
  }

  .button--outline.button--default:hover:not(.button--disabled),
  .button--outline.button--default.button--checked:not(.button--disabled) {
    border-color: var(--sl-color-primary-600);
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--default:active:not(.button--disabled) {
    border-color: var(--sl-color-primary-700);
    background-color: var(--sl-color-primary-700);
    color: var(--sl-color-neutral-0);
  }

  /* Primary */
  .button--outline.button--primary {
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-primary-600);
  }

  .button--outline.button--primary:hover:not(.button--disabled),
  .button--outline.button--primary.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--primary:active:not(.button--disabled) {
    border-color: var(--sl-color-primary-700);
    background-color: var(--sl-color-primary-700);
    color: var(--sl-color-neutral-0);
  }

  /* Success */
  .button--outline.button--success {
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-success-600);
  }

  .button--outline.button--success:hover:not(.button--disabled),
  .button--outline.button--success.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--success:active:not(.button--disabled) {
    border-color: var(--sl-color-success-700);
    background-color: var(--sl-color-success-700);
    color: var(--sl-color-neutral-0);
  }

  /* Neutral */
  .button--outline.button--neutral {
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-600);
  }

  .button--outline.button--neutral:hover:not(.button--disabled),
  .button--outline.button--neutral.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--neutral:active:not(.button--disabled) {
    border-color: var(--sl-color-neutral-700);
    background-color: var(--sl-color-neutral-700);
    color: var(--sl-color-neutral-0);
  }

  /* Warning */
  .button--outline.button--warning {
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-warning-600);
  }

  .button--outline.button--warning:hover:not(.button--disabled),
  .button--outline.button--warning.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--warning:active:not(.button--disabled) {
    border-color: var(--sl-color-warning-700);
    background-color: var(--sl-color-warning-700);
    color: var(--sl-color-neutral-0);
  }

  /* Danger */
  .button--outline.button--danger {
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-danger-600);
  }

  .button--outline.button--danger:hover:not(.button--disabled),
  .button--outline.button--danger.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--danger:active:not(.button--disabled) {
    border-color: var(--sl-color-danger-700);
    background-color: var(--sl-color-danger-700);
    color: var(--sl-color-neutral-0);
  }

  @media (forced-colors: active) {
    .button.button--outline.button--checked:not(.button--disabled) {
      outline: solid 2px transparent;
    }
  }

  /*
   * Text buttons
   */

  .button--text {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-600);
  }

  .button--text:hover:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-500);
  }

  .button--text:focus-visible:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-500);
  }

  .button--text:active:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-700);
  }

  /*
   * Size modifiers
   */

  .button--small {
    height: auto;
    min-height: var(--sl-input-height-small);
    font-size: var(--sl-button-font-size-small);
    line-height: calc(var(--sl-input-height-small) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-small);
  }

  .button--medium {
    height: auto;
    min-height: var(--sl-input-height-medium);
    font-size: var(--sl-button-font-size-medium);
    line-height: calc(var(--sl-input-height-medium) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-medium);
  }

  .button--large {
    height: auto;
    min-height: var(--sl-input-height-large);
    font-size: var(--sl-button-font-size-large);
    line-height: calc(var(--sl-input-height-large) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-large);
  }

  /*
   * Pill modifier
   */

  .button--pill.button--small {
    border-radius: var(--sl-input-height-small);
  }

  .button--pill.button--medium {
    border-radius: var(--sl-input-height-medium);
  }

  .button--pill.button--large {
    border-radius: var(--sl-input-height-large);
  }

  /*
   * Circle modifier
   */

  .button--circle {
    padding-left: 0;
    padding-right: 0;
  }

  .button--circle.button--small {
    width: var(--sl-input-height-small);
    border-radius: 50%;
  }

  .button--circle.button--medium {
    width: var(--sl-input-height-medium);
    border-radius: 50%;
  }

  .button--circle.button--large {
    width: var(--sl-input-height-large);
    border-radius: 50%;
  }

  .button--circle .button__prefix,
  .button--circle .button__suffix,
  .button--circle .button__caret {
    display: none;
  }

  /*
   * Caret modifier
   */

  .button--caret .button__suffix {
    display: none;
  }

  .button--caret .button__caret {
    height: auto;
  }

  /*
   * Loading modifier
   */

  .button--loading {
    position: relative;
    cursor: wait;
  }

  .button--loading .button__prefix,
  .button--loading .button__label,
  .button--loading .button__suffix,
  .button--loading .button__caret {
    visibility: hidden;
  }

  .button--loading sl-spinner {
    --indicator-color: currentColor;
    position: absolute;
    font-size: 1em;
    height: 1em;
    width: 1em;
    top: calc(50% - 0.5em);
    left: calc(50% - 0.5em);
  }

  /*
   * Badges
   */

  .button ::slotted(sl-badge) {
    position: absolute;
    top: 0;
    right: 0;
    translate: 50% -50%;
    pointer-events: none;
  }

  .button--rtl ::slotted(sl-badge) {
    right: auto;
    left: 0;
    translate: -50% -50%;
  }

  /*
   * Button spacing
   */

  .button--has-label.button--small .button__label {
    padding: 0 var(--sl-spacing-small);
  }

  .button--has-label.button--medium .button__label {
    padding: 0 var(--sl-spacing-medium);
  }

  .button--has-label.button--large .button__label {
    padding: 0 var(--sl-spacing-large);
  }

  .button--has-prefix.button--small {
    padding-inline-start: var(--sl-spacing-x-small);
  }

  .button--has-prefix.button--small .button__label {
    padding-inline-start: var(--sl-spacing-x-small);
  }

  .button--has-prefix.button--medium {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--medium .button__label {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--large {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--large .button__label {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-suffix.button--small,
  .button--caret.button--small {
    padding-inline-end: var(--sl-spacing-x-small);
  }

  .button--has-suffix.button--small .button__label,
  .button--caret.button--small .button__label {
    padding-inline-end: var(--sl-spacing-x-small);
  }

  .button--has-suffix.button--medium,
  .button--caret.button--medium {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--medium .button__label,
  .button--caret.button--medium .button__label {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--large,
  .button--caret.button--large {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--large .button__label,
  .button--caret.button--large .button__label {
    padding-inline-end: var(--sl-spacing-small);
  }

  /*
   * Button groups support a variety of button types (e.g. buttons with tooltips, buttons as dropdown triggers, etc.).
   * This means buttons aren't always direct descendants of the button group, thus we can't target them with the
   * ::slotted selector. To work around this, the button group component does some magic to add these special classes to
   * buttons and we style them here instead.
   */

  :host([data-sl-button-group__button--first]:not([data-sl-button-group__button--last])) .button {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  :host([data-sl-button-group__button--inner]) .button {
    border-radius: 0;
  }

  :host([data-sl-button-group__button--last]:not([data-sl-button-group__button--first])) .button {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }

  /* All except the first */
  :host([data-sl-button-group__button]:not([data-sl-button-group__button--first])) {
    margin-inline-start: calc(-1 * var(--sl-input-border-width));
  }

  /* Add a visual separator between solid buttons */
  :host(
      [data-sl-button-group__button]:not(
          [data-sl-button-group__button--first],
          [data-sl-button-group__button--radio],
          [variant='default']
        ):not(:hover)
    )
    .button:after {
    content: '';
    position: absolute;
    top: 0;
    inset-inline-start: 0;
    bottom: 0;
    border-left: solid 1px rgb(128 128 128 / 33%);
    mix-blend-mode: multiply;
  }

  /* Bump hovered, focused, and checked buttons up so their focus ring isn't clipped */
  :host([data-sl-button-group__button--hover]) {
    z-index: 1;
  }

  /* Focus and checked are always on top */
  :host([data-sl-button-group__button--focus]),
  :host([data-sl-button-group__button[checked]]) {
    z-index: 2;
  }
`,R=class extends q{constructor(){super(...arguments),this.formControlController=new Ye(this,{assumeInteractionOn:["click"]}),this.hasSlotController=new ee(this,"[default]","prefix","suffix"),this.localize=new Et(this),this.hasFocus=!1,this.invalid=!1,this.title="",this.variant="default",this.size="medium",this.caret=!1,this.disabled=!1,this.loading=!1,this.outline=!1,this.pill=!1,this.circle=!1,this.type="button",this.name="",this.value="",this.href="",this.rel="noreferrer noopener"}get validity(){return this.isButton()?this.button.validity:Ro}get validationMessage(){return this.isButton()?this.button.validationMessage:""}firstUpdated(){this.isButton()&&this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(){this.type==="submit"&&this.formControlController.submit(this),this.type==="reset"&&this.formControlController.reset(this)}handleInvalid(t){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(t)}isButton(){return!this.href}isLink(){return!!this.href}handleDisabledChange(){this.isButton()&&this.formControlController.setValidity(this.disabled)}click(){this.button.click()}focus(t){this.button.focus(t)}blur(){this.button.blur()}checkValidity(){return this.isButton()?this.button.checkValidity():!0}getForm(){return this.formControlController.getForm()}reportValidity(){return this.isButton()?this.button.reportValidity():!0}setCustomValidity(t){this.isButton()&&(this.button.setCustomValidity(t),this.formControlController.updateValidity())}render(){const t=this.isLink(),e=t?He`a`:He`button`;return Ie`
      <${e}
        part="base"
        class=${X({button:!0,"button--default":this.variant==="default","button--primary":this.variant==="primary","button--success":this.variant==="success","button--neutral":this.variant==="neutral","button--warning":this.variant==="warning","button--danger":this.variant==="danger","button--text":this.variant==="text","button--small":this.size==="small","button--medium":this.size==="medium","button--large":this.size==="large","button--caret":this.caret,"button--circle":this.circle,"button--disabled":this.disabled,"button--focused":this.hasFocus,"button--loading":this.loading,"button--standard":!this.outline,"button--outline":this.outline,"button--pill":this.pill,"button--rtl":this.localize.dir()==="rtl","button--has-label":this.hasSlotController.test("[default]"),"button--has-prefix":this.hasSlotController.test("prefix"),"button--has-suffix":this.hasSlotController.test("suffix")})}
        ?disabled=${L(t?void 0:this.disabled)}
        type=${L(t?void 0:this.type)}
        title=${this.title}
        name=${L(t?void 0:this.name)}
        value=${L(t?void 0:this.value)}
        href=${L(t?this.href:void 0)}
        target=${L(t?this.target:void 0)}
        download=${L(t?this.download:void 0)}
        rel=${L(t?this.rel:void 0)}
        role=${L(t?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @invalid=${this.isButton()?this.handleInvalid:null}
        @click=${this.handleClick}
      >
        <slot name="prefix" part="prefix" class="button__prefix"></slot>
        <slot part="label" class="button__label"></slot>
        <slot name="suffix" part="suffix" class="button__suffix"></slot>
        ${this.caret?Ie` <sl-icon part="caret" class="button__caret" library="system" name="caret"></sl-icon> `:""}
        ${this.loading?Ie`<sl-spinner part="spinner"></sl-spinner>`:""}
      </${e}>
    `}};R.styles=[tt,br];R.dependencies={"sl-icon":lt,"sl-spinner":qi};a([H(".button")],R.prototype,"button",2);a([dt()],R.prototype,"hasFocus",2);a([dt()],R.prototype,"invalid",2);a([u()],R.prototype,"title",2);a([u({reflect:!0})],R.prototype,"variant",2);a([u({reflect:!0})],R.prototype,"size",2);a([u({type:Boolean,reflect:!0})],R.prototype,"caret",2);a([u({type:Boolean,reflect:!0})],R.prototype,"disabled",2);a([u({type:Boolean,reflect:!0})],R.prototype,"loading",2);a([u({type:Boolean,reflect:!0})],R.prototype,"outline",2);a([u({type:Boolean,reflect:!0})],R.prototype,"pill",2);a([u({type:Boolean,reflect:!0})],R.prototype,"circle",2);a([u()],R.prototype,"type",2);a([u()],R.prototype,"name",2);a([u()],R.prototype,"value",2);a([u()],R.prototype,"href",2);a([u()],R.prototype,"target",2);a([u()],R.prototype,"rel",2);a([u()],R.prototype,"download",2);a([u()],R.prototype,"form",2);a([u({attribute:"formaction"})],R.prototype,"formAction",2);a([u({attribute:"formenctype"})],R.prototype,"formEnctype",2);a([u({attribute:"formmethod"})],R.prototype,"formMethod",2);a([u({attribute:"formnovalidate",type:Boolean})],R.prototype,"formNoValidate",2);a([u({attribute:"formtarget"})],R.prototype,"formTarget",2);a([N("disabled",{waitUntilFirstUpdate:!0})],R.prototype,"handleDisabledChange",1);R.define("sl-button");var mr=G`
  :host {
    --border-color: var(--sl-color-neutral-200);
    --border-radius: var(--sl-border-radius-medium);
    --border-width: 1px;
    --padding: var(--sl-spacing-large);

    display: inline-block;
  }

  .card {
    display: flex;
    flex-direction: column;
    background-color: var(--sl-panel-background-color);
    box-shadow: var(--sl-shadow-x-small);
    border: solid var(--border-width) var(--border-color);
    border-radius: var(--border-radius);
  }

  .card__image {
    display: flex;
    border-top-left-radius: var(--border-radius);
    border-top-right-radius: var(--border-radius);
    margin: calc(-1 * var(--border-width));
    overflow: hidden;
  }

  .card__image::slotted(img) {
    display: block;
    width: 100%;
  }

  .card:not(.card--has-image) .card__image {
    display: none;
  }

  .card__header {
    display: block;
    border-bottom: solid var(--border-width) var(--border-color);
    padding: calc(var(--padding) / 2) var(--padding);
  }

  .card:not(.card--has-header) .card__header {
    display: none;
  }

  .card:not(.card--has-image) .card__header {
    border-top-left-radius: var(--border-radius);
    border-top-right-radius: var(--border-radius);
  }

  .card__body {
    display: block;
    padding: var(--padding);
  }

  .card--has-footer .card__footer {
    display: block;
    border-top: solid var(--border-width) var(--border-color);
    padding: var(--padding);
  }

  .card:not(.card--has-footer) .card__footer {
    display: none;
  }
`,Ki=class extends q{constructor(){super(...arguments),this.hasSlotController=new ee(this,"footer","header","image")}render(){return T`
      <div
        part="base"
        class=${X({card:!0,"card--has-footer":this.hasSlotController.test("footer"),"card--has-image":this.hasSlotController.test("image"),"card--has-header":this.hasSlotController.test("header")})}
      >
        <slot name="image" part="image" class="card__image"></slot>
        <slot name="header" part="header" class="card__header"></slot>
        <slot part="body" class="card__body"></slot>
        <slot name="footer" part="footer" class="card__footer"></slot>
      </div>
    `}};Ki.styles=[tt,mr];Ki.define("sl-card");var gr=G`
  :host {
    display: inline-block;
  }

  .checkbox {
    position: relative;
    display: inline-flex;
    align-items: flex-start;
    font-family: var(--sl-input-font-family);
    font-weight: var(--sl-input-font-weight);
    color: var(--sl-input-label-color);
    vertical-align: middle;
    cursor: pointer;
  }

  .checkbox--small {
    --toggle-size: var(--sl-toggle-size-small);
    font-size: var(--sl-input-font-size-small);
  }

  .checkbox--medium {
    --toggle-size: var(--sl-toggle-size-medium);
    font-size: var(--sl-input-font-size-medium);
  }

  .checkbox--large {
    --toggle-size: var(--sl-toggle-size-large);
    font-size: var(--sl-input-font-size-large);
  }

  .checkbox__control {
    flex: 0 0 auto;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--toggle-size);
    height: var(--toggle-size);
    border: solid var(--sl-input-border-width) var(--sl-input-border-color);
    border-radius: 2px;
    background-color: var(--sl-input-background-color);
    color: var(--sl-color-neutral-0);
    transition:
      var(--sl-transition-fast) border-color,
      var(--sl-transition-fast) background-color,
      var(--sl-transition-fast) color,
      var(--sl-transition-fast) box-shadow;
  }

  .checkbox__input {
    position: absolute;
    opacity: 0;
    padding: 0;
    margin: 0;
    pointer-events: none;
  }

  .checkbox__checked-icon,
  .checkbox__indeterminate-icon {
    display: inline-flex;
    width: var(--toggle-size);
    height: var(--toggle-size);
  }

  /* Hover */
  .checkbox:not(.checkbox--checked):not(.checkbox--disabled) .checkbox__control:hover {
    border-color: var(--sl-input-border-color-hover);
    background-color: var(--sl-input-background-color-hover);
  }

  /* Focus */
  .checkbox:not(.checkbox--checked):not(.checkbox--disabled) .checkbox__input:focus-visible ~ .checkbox__control {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  /* Checked/indeterminate */
  .checkbox--checked .checkbox__control,
  .checkbox--indeterminate .checkbox__control {
    border-color: var(--sl-color-primary-600);
    background-color: var(--sl-color-primary-600);
  }

  /* Checked/indeterminate + hover */
  .checkbox.checkbox--checked:not(.checkbox--disabled) .checkbox__control:hover,
  .checkbox.checkbox--indeterminate:not(.checkbox--disabled) .checkbox__control:hover {
    border-color: var(--sl-color-primary-500);
    background-color: var(--sl-color-primary-500);
  }

  /* Checked/indeterminate + focus */
  .checkbox.checkbox--checked:not(.checkbox--disabled) .checkbox__input:focus-visible ~ .checkbox__control,
  .checkbox.checkbox--indeterminate:not(.checkbox--disabled) .checkbox__input:focus-visible ~ .checkbox__control {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  /* Disabled */
  .checkbox--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkbox__label {
    display: inline-block;
    color: var(--sl-input-label-color);
    line-height: var(--toggle-size);
    margin-inline-start: 0.5em;
    user-select: none;
    -webkit-user-select: none;
  }

  :host([required]) .checkbox__label::after {
    content: var(--sl-input-required-content);
    color: var(--sl-input-required-content-color);
    margin-inline-start: var(--sl-input-required-content-offset);
  }
`,Bo=(t="value")=>(e,o)=>{const i=e.constructor,s=i.prototype.attributeChangedCallback;i.prototype.attributeChangedCallback=function(r,n,l){var c;const p=i.getPropertyOptions(t),b=typeof p.attribute=="string"?p.attribute:t;if(r===b){const f=p.converter||ae,v=(typeof f=="function"?f:(c=f==null?void 0:f.fromAttribute)!=null?c:ae.fromAttribute)(l,p.type);this[t]!==v&&(this[o]=v)}s.call(this,r,n,l)}},Io=G`
  .form-control .form-control__label {
    display: none;
  }

  .form-control .form-control__help-text {
    display: none;
  }

  /* Label */
  .form-control--has-label .form-control__label {
    display: inline-block;
    color: var(--sl-input-label-color);
    margin-bottom: var(--sl-spacing-3x-small);
  }

  .form-control--has-label.form-control--small .form-control__label {
    font-size: var(--sl-input-label-font-size-small);
  }

  .form-control--has-label.form-control--medium .form-control__label {
    font-size: var(--sl-input-label-font-size-medium);
  }

  .form-control--has-label.form-control--large .form-control__label {
    font-size: var(--sl-input-label-font-size-large);
  }

  :host([required]) .form-control--has-label .form-control__label::after {
    content: var(--sl-input-required-content);
    margin-inline-start: var(--sl-input-required-content-offset);
    color: var(--sl-input-required-content-color);
  }

  /* Help text */
  .form-control--has-help-text .form-control__help-text {
    display: block;
    color: var(--sl-input-help-text-color);
    margin-top: var(--sl-spacing-3x-small);
  }

  .form-control--has-help-text.form-control--small .form-control__help-text {
    font-size: var(--sl-input-help-text-font-size-small);
  }

  .form-control--has-help-text.form-control--medium .form-control__help-text {
    font-size: var(--sl-input-help-text-font-size-medium);
  }

  .form-control--has-help-text.form-control--large .form-control__help-text {
    font-size: var(--sl-input-help-text-font-size-large);
  }

  .form-control--has-help-text.form-control--radio-group .form-control__help-text {
    margin-top: var(--sl-spacing-2x-small);
  }
`;/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const _o=Lo(class extends Oo{constructor(t){if(super(t),t.type!==Ft.PROPERTY&&t.type!==Ft.ATTRIBUTE&&t.type!==Ft.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!ir(t))throw Error("`live` bindings can only contain a single expression")}render(t){return t}update(t,[e]){if(e===_t||e===j)return e;const o=t.element,i=t.name;if(t.type===Ft.PROPERTY){if(e===o[i])return _t}else if(t.type===Ft.BOOLEAN_ATTRIBUTE){if(!!e===o.hasAttribute(i))return _t}else if(t.type===Ft.ATTRIBUTE&&o.getAttribute(i)===e+"")return _t;return rr(t),e}});var et=class extends q{constructor(){super(...arguments),this.formControlController=new Ye(this,{value:t=>t.checked?t.value||"on":void 0,defaultValue:t=>t.defaultChecked,setValue:(t,e)=>t.checked=e}),this.hasSlotController=new ee(this,"help-text"),this.hasFocus=!1,this.title="",this.name="",this.size="medium",this.disabled=!1,this.checked=!1,this.indeterminate=!1,this.defaultChecked=!1,this.form="",this.required=!1,this.helpText=""}get validity(){return this.input.validity}get validationMessage(){return this.input.validationMessage}firstUpdated(){this.formControlController.updateValidity()}handleClick(){this.checked=!this.checked,this.indeterminate=!1,this.emit("sl-change")}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleInput(){this.emit("sl-input")}handleInvalid(t){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(t)}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleDisabledChange(){this.formControlController.setValidity(this.disabled)}handleStateChange(){this.input.checked=this.checked,this.input.indeterminate=this.indeterminate,this.formControlController.updateValidity()}click(){this.input.click()}focus(t){this.input.focus(t)}blur(){this.input.blur()}checkValidity(){return this.input.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.input.reportValidity()}setCustomValidity(t){this.input.setCustomValidity(t),this.formControlController.updateValidity()}render(){const t=this.hasSlotController.test("help-text"),e=this.helpText?!0:!!t;return T`
      <div
        class=${X({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-help-text":e})}
      >
        <label
          part="base"
          class=${X({checkbox:!0,"checkbox--checked":this.checked,"checkbox--disabled":this.disabled,"checkbox--focused":this.hasFocus,"checkbox--indeterminate":this.indeterminate,"checkbox--small":this.size==="small","checkbox--medium":this.size==="medium","checkbox--large":this.size==="large"})}
        >
          <input
            class="checkbox__input"
            type="checkbox"
            title=${this.title}
            name=${this.name}
            value=${L(this.value)}
            .indeterminate=${_o(this.indeterminate)}
            .checked=${_o(this.checked)}
            .disabled=${this.disabled}
            .required=${this.required}
            aria-checked=${this.checked?"true":"false"}
            aria-describedby="help-text"
            @click=${this.handleClick}
            @input=${this.handleInput}
            @invalid=${this.handleInvalid}
            @blur=${this.handleBlur}
            @focus=${this.handleFocus}
          />

          <span
            part="control${this.checked?" control--checked":""}${this.indeterminate?" control--indeterminate":""}"
            class="checkbox__control"
          >
            ${this.checked?T`
                  <sl-icon part="checked-icon" class="checkbox__checked-icon" library="system" name="check"></sl-icon>
                `:""}
            ${!this.checked&&this.indeterminate?T`
                  <sl-icon
                    part="indeterminate-icon"
                    class="checkbox__indeterminate-icon"
                    library="system"
                    name="indeterminate"
                  ></sl-icon>
                `:""}
          </span>

          <div part="label" class="checkbox__label">
            <slot></slot>
          </div>
        </label>

        <div
          aria-hidden=${e?"false":"true"}
          class="form-control__help-text"
          id="help-text"
          part="form-control-help-text"
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `}};et.styles=[tt,Io,gr];et.dependencies={"sl-icon":lt};a([H('input[type="checkbox"]')],et.prototype,"input",2);a([dt()],et.prototype,"hasFocus",2);a([u()],et.prototype,"title",2);a([u()],et.prototype,"name",2);a([u()],et.prototype,"value",2);a([u({reflect:!0})],et.prototype,"size",2);a([u({type:Boolean,reflect:!0})],et.prototype,"disabled",2);a([u({type:Boolean,reflect:!0})],et.prototype,"checked",2);a([u({type:Boolean,reflect:!0})],et.prototype,"indeterminate",2);a([Bo("checked")],et.prototype,"defaultChecked",2);a([u({reflect:!0})],et.prototype,"form",2);a([u({type:Boolean,reflect:!0})],et.prototype,"required",2);a([u({attribute:"help-text"})],et.prototype,"helpText",2);a([N("disabled",{waitUntilFirstUpdate:!0})],et.prototype,"handleDisabledChange",1);a([N(["checked","indeterminate"],{waitUntilFirstUpdate:!0})],et.prototype,"handleStateChange",1);et.define("sl-checkbox");var wi=new WeakMap;function Yi(t){let e=wi.get(t);return e||(e=window.getComputedStyle(t,null),wi.set(t,e)),e}function vr(t){if(typeof t.checkVisibility=="function")return t.checkVisibility({checkOpacity:!1,checkVisibilityCSS:!0});const e=Yi(t);return e.visibility!=="hidden"&&e.display!=="none"}function yr(t){const e=Yi(t),{overflowY:o,overflowX:i}=e;return o==="scroll"||i==="scroll"?!0:o!=="auto"||i!=="auto"?!1:t.scrollHeight>t.clientHeight&&o==="auto"||t.scrollWidth>t.clientWidth&&i==="auto"}function _r(t){const e=t.tagName.toLowerCase(),o=Number(t.getAttribute("tabindex"));return t.hasAttribute("tabindex")&&(isNaN(o)||o<=-1)||t.hasAttribute("disabled")||t.closest("[inert]")||e==="input"&&t.getAttribute("type")==="radio"&&!t.hasAttribute("checked")||!vr(t)?!1:(e==="audio"||e==="video")&&t.hasAttribute("controls")||t.hasAttribute("tabindex")||t.hasAttribute("contenteditable")&&t.getAttribute("contenteditable")!=="false"||["button","input","select","textarea","a","audio","video","summary","iframe"].includes(e)?!0:yr(t)}function wr(t,e){var o;return((o=t.getRootNode({composed:!0}))==null?void 0:o.host)!==e}function xi(t){const e=new WeakMap,o=[];function i(s){if(s instanceof Element){if(s.hasAttribute("inert")||s.closest("[inert]")||e.has(s))return;e.set(s,!0),!o.includes(s)&&_r(s)&&o.push(s),s instanceof HTMLSlotElement&&wr(s,t)&&s.assignedElements({flatten:!0}).forEach(r=>{i(r)}),s.shadowRoot!==null&&s.shadowRoot.mode==="open"&&i(s.shadowRoot)}for(const r of s.children)i(r)}return i(t),o.sort((s,r)=>{const n=Number(s.getAttribute("tabindex"))||0;return(Number(r.getAttribute("tabindex"))||0)-n})}function*Fo(t=document.activeElement){t!=null&&(yield t,"shadowRoot"in t&&t.shadowRoot&&t.shadowRoot.mode!=="closed"&&(yield*Zs(Fo(t.shadowRoot.activeElement))))}function xr(){return[...Fo()].pop()}var _e=[],kr=class{constructor(t){this.tabDirection="forward",this.handleFocusIn=()=>{this.isActive()&&this.checkFocus()},this.handleKeyDown=e=>{var o;if(e.key!=="Tab"||this.isExternalActivated||!this.isActive())return;const i=xr();if(this.previousFocus=i,this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus))return;e.shiftKey?this.tabDirection="backward":this.tabDirection="forward";const s=xi(this.element);let r=s.findIndex(l=>l===i);this.previousFocus=this.currentFocus;const n=this.tabDirection==="forward"?1:-1;for(;;){r+n>=s.length?r=0:r+n<0?r=s.length-1:r+=n,this.previousFocus=this.currentFocus;const l=s[r];if(this.tabDirection==="backward"&&this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus)||l&&this.possiblyHasTabbableChildren(l))return;e.preventDefault(),this.currentFocus=l,(o=this.currentFocus)==null||o.focus({preventScroll:!1});const c=[...Fo()];if(c.includes(this.currentFocus)||!c.includes(this.previousFocus))break}setTimeout(()=>this.checkFocus())},this.handleKeyUp=()=>{this.tabDirection="forward"},this.element=t,this.elementsWithTabbableControls=["iframe"]}activate(){_e.push(this.element),document.addEventListener("focusin",this.handleFocusIn),document.addEventListener("keydown",this.handleKeyDown),document.addEventListener("keyup",this.handleKeyUp)}deactivate(){_e=_e.filter(t=>t!==this.element),this.currentFocus=null,document.removeEventListener("focusin",this.handleFocusIn),document.removeEventListener("keydown",this.handleKeyDown),document.removeEventListener("keyup",this.handleKeyUp)}isActive(){return _e[_e.length-1]===this.element}activateExternal(){this.isExternalActivated=!0}deactivateExternal(){this.isExternalActivated=!1}checkFocus(){if(this.isActive()&&!this.isExternalActivated){const t=xi(this.element);if(!this.element.matches(":focus-within")){const e=t[0],o=t[t.length-1],i=this.tabDirection==="forward"?e:o;typeof(i==null?void 0:i.focus)=="function"&&(this.currentFocus=i,i.focus({preventScroll:!1}))}}}possiblyHasTabbableChildren(t){return this.elementsWithTabbableControls.includes(t.tagName.toLowerCase())||t.hasAttribute("controls")}};function Cr(t,e){return{top:Math.round(t.getBoundingClientRect().top-e.getBoundingClientRect().top),left:Math.round(t.getBoundingClientRect().left-e.getBoundingClientRect().left)}}var wo=new Set;function $r(){const t=document.documentElement.clientWidth;return Math.abs(window.innerWidth-t)}function Ar(){const t=Number(getComputedStyle(document.body).paddingRight.replace(/px/,""));return isNaN(t)||!t?0:t}function ki(t){if(wo.add(t),!document.documentElement.classList.contains("sl-scroll-lock")){const e=$r()+Ar();document.documentElement.classList.add("sl-scroll-lock"),document.documentElement.style.setProperty("--sl-scroll-lock-size",`${e}px`)}}function Ci(t){wo.delete(t),wo.size===0&&(document.documentElement.classList.remove("sl-scroll-lock"),document.documentElement.style.removeProperty("--sl-scroll-lock-size"))}function xo(t,e,o="vertical",i="smooth"){const s=Cr(t,e),r=s.top+e.scrollTop,n=s.left+e.scrollLeft,l=e.scrollLeft,c=e.scrollLeft+e.offsetWidth,p=e.scrollTop,b=e.scrollTop+e.offsetHeight;(o==="horizontal"||o==="both")&&(n<l?e.scrollTo({left:n,behavior:i}):n+t.clientWidth>c&&e.scrollTo({left:n-e.offsetWidth+t.clientWidth,behavior:i})),(o==="vertical"||o==="both")&&(r<p?e.scrollTo({top:r,behavior:i}):r+t.clientHeight>b&&e.scrollTo({top:r-e.offsetHeight+t.clientHeight,behavior:i}))}var Sr=G`
  :host {
    --width: 31rem;
    --header-spacing: var(--sl-spacing-large);
    --body-spacing: var(--sl-spacing-large);
    --footer-spacing: var(--sl-spacing-large);

    display: contents;
  }

  .dialog {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: var(--sl-z-index-dialog);
  }

  .dialog__panel {
    display: flex;
    flex-direction: column;
    z-index: 2;
    width: var(--width);
    max-width: calc(100% - var(--sl-spacing-2x-large));
    max-height: calc(100% - var(--sl-spacing-2x-large));
    background-color: var(--sl-panel-background-color);
    border-radius: var(--sl-border-radius-medium);
    box-shadow: var(--sl-shadow-x-large);
  }

  .dialog__panel:focus {
    outline: none;
  }

  /* Ensure there's enough vertical padding for phones that don't update vh when chrome appears (e.g. iPhone) */
  @media screen and (max-width: 420px) {
    .dialog__panel {
      max-height: 80vh;
    }
  }

  .dialog--open .dialog__panel {
    display: flex;
    opacity: 1;
  }

  .dialog__header {
    flex: 0 0 auto;
    display: flex;
  }

  .dialog__title {
    flex: 1 1 auto;
    font: inherit;
    font-size: var(--sl-font-size-large);
    line-height: var(--sl-line-height-dense);
    padding: var(--header-spacing);
    margin: 0;
  }

  .dialog__header-actions {
    flex-shrink: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: end;
    gap: var(--sl-spacing-2x-small);
    padding: 0 var(--header-spacing);
  }

  .dialog__header-actions sl-icon-button,
  .dialog__header-actions ::slotted(sl-icon-button) {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    font-size: var(--sl-font-size-medium);
  }

  .dialog__body {
    flex: 1 1 auto;
    display: block;
    padding: var(--body-spacing);
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }

  .dialog__footer {
    flex: 0 0 auto;
    text-align: right;
    padding: var(--footer-spacing);
  }

  .dialog__footer ::slotted(sl-button:not(:first-of-type)) {
    margin-inline-start: var(--sl-spacing-x-small);
  }

  .dialog:not(.dialog--has-footer) .dialog__footer {
    display: none;
  }

  .dialog__overlay {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background-color: var(--sl-overlay-background-color);
  }

  @media (forced-colors: active) {
    .dialog__panel {
      border: solid 1px var(--sl-color-neutral-0);
    }
  }
`,Ot=class extends q{constructor(){super(...arguments),this.hasSlotController=new ee(this,"footer"),this.localize=new Et(this),this.modal=new kr(this),this.open=!1,this.label="",this.noHeader=!1,this.handleDocumentKeyDown=t=>{t.key==="Escape"&&this.modal.isActive()&&this.open&&(t.stopPropagation(),this.requestClose("keyboard"))}}firstUpdated(){this.dialog.hidden=!this.open,this.open&&(this.addOpenListeners(),this.modal.activate(),ki(this))}disconnectedCallback(){var t;super.disconnectedCallback(),this.modal.deactivate(),Ci(this),(t=this.closeWatcher)==null||t.destroy()}requestClose(t){if(this.emit("sl-request-close",{cancelable:!0,detail:{source:t}}).defaultPrevented){const o=kt(this,"dialog.denyClose",{dir:this.localize.dir()});Ct(this.panel,o.keyframes,o.options);return}this.hide()}addOpenListeners(){var t;"CloseWatcher"in window?((t=this.closeWatcher)==null||t.destroy(),this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>this.requestClose("keyboard")):document.addEventListener("keydown",this.handleDocumentKeyDown)}removeOpenListeners(){var t;(t=this.closeWatcher)==null||t.destroy(),document.removeEventListener("keydown",this.handleDocumentKeyDown)}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.addOpenListeners(),this.originalTrigger=document.activeElement,this.modal.activate(),ki(this);const t=this.querySelector("[autofocus]");t&&t.removeAttribute("autofocus"),await Promise.all([Tt(this.dialog),Tt(this.overlay)]),this.dialog.hidden=!1,requestAnimationFrame(()=>{this.emit("sl-initial-focus",{cancelable:!0}).defaultPrevented||(t?t.focus({preventScroll:!0}):this.panel.focus({preventScroll:!0})),t&&t.setAttribute("autofocus","")});const e=kt(this,"dialog.show",{dir:this.localize.dir()}),o=kt(this,"dialog.overlay.show",{dir:this.localize.dir()});await Promise.all([Ct(this.panel,e.keyframes,e.options),Ct(this.overlay,o.keyframes,o.options)]),this.emit("sl-after-show")}else{this.emit("sl-hide"),this.removeOpenListeners(),this.modal.deactivate(),await Promise.all([Tt(this.dialog),Tt(this.overlay)]);const t=kt(this,"dialog.hide",{dir:this.localize.dir()}),e=kt(this,"dialog.overlay.hide",{dir:this.localize.dir()});await Promise.all([Ct(this.overlay,e.keyframes,e.options).then(()=>{this.overlay.hidden=!0}),Ct(this.panel,t.keyframes,t.options).then(()=>{this.panel.hidden=!0})]),this.dialog.hidden=!0,this.overlay.hidden=!1,this.panel.hidden=!1,Ci(this);const o=this.originalTrigger;typeof(o==null?void 0:o.focus)=="function"&&setTimeout(()=>o.focus()),this.emit("sl-after-hide")}}async show(){if(!this.open)return this.open=!0,Vt(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Vt(this,"sl-after-hide")}render(){return T`
      <div
        part="base"
        class=${X({dialog:!0,"dialog--open":this.open,"dialog--has-footer":this.hasSlotController.test("footer")})}
      >
        <div part="overlay" class="dialog__overlay" @click=${()=>this.requestClose("overlay")} tabindex="-1"></div>

        <div
          part="panel"
          class="dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-hidden=${this.open?"false":"true"}
          aria-label=${L(this.noHeader?this.label:void 0)}
          aria-labelledby=${L(this.noHeader?void 0:"title")}
          tabindex="-1"
        >
          ${this.noHeader?"":T`
                <header part="header" class="dialog__header">
                  <h2 part="title" class="dialog__title" id="title">
                    <slot name="label"> ${this.label.length>0?this.label:"\uFEFF"} </slot>
                  </h2>
                  <div part="header-actions" class="dialog__header-actions">
                    <slot name="header-actions"></slot>
                    <sl-icon-button
                      part="close-button"
                      exportparts="base:close-button__base"
                      class="dialog__close"
                      name="x-lg"
                      label=${this.localize.term("close")}
                      library="system"
                      @click="${()=>this.requestClose("close-button")}"
                    ></sl-icon-button>
                  </div>
                </header>
              `}
          ${""}
          <div part="body" class="dialog__body" tabindex="-1"><slot></slot></div>

          <footer part="footer" class="dialog__footer">
            <slot name="footer"></slot>
          </footer>
        </div>
      </div>
    `}};Ot.styles=[tt,Sr];Ot.dependencies={"sl-icon-button":ot};a([H(".dialog")],Ot.prototype,"dialog",2);a([H(".dialog__panel")],Ot.prototype,"panel",2);a([H(".dialog__overlay")],Ot.prototype,"overlay",2);a([u({type:Boolean,reflect:!0})],Ot.prototype,"open",2);a([u({reflect:!0})],Ot.prototype,"label",2);a([u({attribute:"no-header",type:Boolean,reflect:!0})],Ot.prototype,"noHeader",2);a([N("open",{waitUntilFirstUpdate:!0})],Ot.prototype,"handleOpenChange",1);St("dialog.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:250,easing:"ease"}});St("dialog.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:250,easing:"ease"}});St("dialog.denyClose",{keyframes:[{scale:1},{scale:1.02},{scale:1}],options:{duration:250}});St("dialog.overlay.show",{keyframes:[{opacity:0},{opacity:1}],options:{duration:250}});St("dialog.overlay.hide",{keyframes:[{opacity:1},{opacity:0}],options:{duration:250}});Ot.define("sl-dialog");lt.define("sl-icon");var Er=G`
  :host {
    display: block;
  }

  .input {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: stretch;
    justify-content: start;
    position: relative;
    width: 100%;
    font-family: var(--sl-input-font-family);
    font-weight: var(--sl-input-font-weight);
    letter-spacing: var(--sl-input-letter-spacing);
    vertical-align: middle;
    overflow: hidden;
    cursor: text;
    transition:
      var(--sl-transition-fast) color,
      var(--sl-transition-fast) border,
      var(--sl-transition-fast) box-shadow,
      var(--sl-transition-fast) background-color;
  }

  /* Standard inputs */
  .input--standard {
    background-color: var(--sl-input-background-color);
    border: solid var(--sl-input-border-width) var(--sl-input-border-color);
  }

  .input--standard:hover:not(.input--disabled) {
    background-color: var(--sl-input-background-color-hover);
    border-color: var(--sl-input-border-color-hover);
  }

  .input--standard.input--focused:not(.input--disabled) {
    background-color: var(--sl-input-background-color-focus);
    border-color: var(--sl-input-border-color-focus);
    box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-input-focus-ring-color);
  }

  .input--standard.input--focused:not(.input--disabled) .input__control {
    color: var(--sl-input-color-focus);
  }

  .input--standard.input--disabled {
    background-color: var(--sl-input-background-color-disabled);
    border-color: var(--sl-input-border-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input--standard.input--disabled .input__control {
    color: var(--sl-input-color-disabled);
  }

  .input--standard.input--disabled .input__control::placeholder {
    color: var(--sl-input-placeholder-color-disabled);
  }

  /* Filled inputs */
  .input--filled {
    border: none;
    background-color: var(--sl-input-filled-background-color);
    color: var(--sl-input-color);
  }

  .input--filled:hover:not(.input--disabled) {
    background-color: var(--sl-input-filled-background-color-hover);
  }

  .input--filled.input--focused:not(.input--disabled) {
    background-color: var(--sl-input-filled-background-color-focus);
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .input--filled.input--disabled {
    background-color: var(--sl-input-filled-background-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input__control {
    flex: 1 1 auto;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    min-width: 0;
    height: 100%;
    color: var(--sl-input-color);
    border: none;
    background: inherit;
    box-shadow: none;
    padding: 0;
    margin: 0;
    cursor: inherit;
    -webkit-appearance: none;
  }

  .input__control::-webkit-search-decoration,
  .input__control::-webkit-search-cancel-button,
  .input__control::-webkit-search-results-button,
  .input__control::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }

  .input__control:-webkit-autofill,
  .input__control:-webkit-autofill:hover,
  .input__control:-webkit-autofill:focus,
  .input__control:-webkit-autofill:active {
    box-shadow: 0 0 0 var(--sl-input-height-large) var(--sl-input-background-color-hover) inset !important;
    -webkit-text-fill-color: var(--sl-color-primary-500);
    caret-color: var(--sl-input-color);
  }

  .input--filled .input__control:-webkit-autofill,
  .input--filled .input__control:-webkit-autofill:hover,
  .input--filled .input__control:-webkit-autofill:focus,
  .input--filled .input__control:-webkit-autofill:active {
    box-shadow: 0 0 0 var(--sl-input-height-large) var(--sl-input-filled-background-color) inset !important;
  }

  .input__control::placeholder {
    color: var(--sl-input-placeholder-color);
    user-select: none;
    -webkit-user-select: none;
  }

  .input:hover:not(.input--disabled) .input__control {
    color: var(--sl-input-color-hover);
  }

  .input__control:focus {
    outline: none;
  }

  .input__prefix,
  .input__suffix {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    cursor: default;
  }

  .input__prefix ::slotted(sl-icon),
  .input__suffix ::slotted(sl-icon) {
    color: var(--sl-input-icon-color);
  }

  /*
   * Size modifiers
   */

  .input--small {
    border-radius: var(--sl-input-border-radius-small);
    font-size: var(--sl-input-font-size-small);
    height: var(--sl-input-height-small);
  }

  .input--small .input__control {
    height: calc(var(--sl-input-height-small) - var(--sl-input-border-width) * 2);
    padding: 0 var(--sl-input-spacing-small);
  }

  .input--small .input__clear,
  .input--small .input__password-toggle {
    width: calc(1em + var(--sl-input-spacing-small) * 2);
  }

  .input--small .input__prefix ::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-small);
  }

  .input--small .input__suffix ::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-small);
  }

  .input--medium {
    border-radius: var(--sl-input-border-radius-medium);
    font-size: var(--sl-input-font-size-medium);
    height: var(--sl-input-height-medium);
  }

  .input--medium .input__control {
    height: calc(var(--sl-input-height-medium) - var(--sl-input-border-width) * 2);
    padding: 0 var(--sl-input-spacing-medium);
  }

  .input--medium .input__clear,
  .input--medium .input__password-toggle {
    width: calc(1em + var(--sl-input-spacing-medium) * 2);
  }

  .input--medium .input__prefix ::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-medium);
  }

  .input--medium .input__suffix ::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-medium);
  }

  .input--large {
    border-radius: var(--sl-input-border-radius-large);
    font-size: var(--sl-input-font-size-large);
    height: var(--sl-input-height-large);
  }

  .input--large .input__control {
    height: calc(var(--sl-input-height-large) - var(--sl-input-border-width) * 2);
    padding: 0 var(--sl-input-spacing-large);
  }

  .input--large .input__clear,
  .input--large .input__password-toggle {
    width: calc(1em + var(--sl-input-spacing-large) * 2);
  }

  .input--large .input__prefix ::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-large);
  }

  .input--large .input__suffix ::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-large);
  }

  /*
   * Pill modifier
   */

  .input--pill.input--small {
    border-radius: var(--sl-input-height-small);
  }

  .input--pill.input--medium {
    border-radius: var(--sl-input-height-medium);
  }

  .input--pill.input--large {
    border-radius: var(--sl-input-height-large);
  }

  /*
   * Clearable + Password Toggle
   */

  .input__clear,
  .input__password-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: inherit;
    color: var(--sl-input-icon-color);
    border: none;
    background: none;
    padding: 0;
    transition: var(--sl-transition-fast) color;
    cursor: pointer;
  }

  .input__clear:hover,
  .input__password-toggle:hover {
    color: var(--sl-input-icon-color-hover);
  }

  .input__clear:focus,
  .input__password-toggle:focus {
    outline: none;
  }

  /* Don't show the browser's password toggle in Edge */
  ::-ms-reveal {
    display: none;
  }

  /* Hide the built-in number spinner */
  .input--no-spin-buttons input[type='number']::-webkit-outer-spin-button,
  .input--no-spin-buttons input[type='number']::-webkit-inner-spin-button {
    -webkit-appearance: none;
    display: none;
  }

  .input--no-spin-buttons input[type='number'] {
    -moz-appearance: textfield;
  }
`,S=class extends q{constructor(){super(...arguments),this.formControlController=new Ye(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new ee(this,"help-text","label"),this.localize=new Et(this),this.hasFocus=!1,this.title="",this.__numberInput=Object.assign(document.createElement("input"),{type:"number"}),this.__dateInput=Object.assign(document.createElement("input"),{type:"date"}),this.type="text",this.name="",this.value="",this.defaultValue="",this.size="medium",this.filled=!1,this.pill=!1,this.label="",this.helpText="",this.clearable=!1,this.disabled=!1,this.placeholder="",this.readonly=!1,this.passwordToggle=!1,this.passwordVisible=!1,this.noSpinButtons=!1,this.form="",this.required=!1,this.spellcheck=!0}get valueAsDate(){var t;return this.__dateInput.type=this.type,this.__dateInput.value=this.value,((t=this.input)==null?void 0:t.valueAsDate)||this.__dateInput.valueAsDate}set valueAsDate(t){this.__dateInput.type=this.type,this.__dateInput.valueAsDate=t,this.value=this.__dateInput.value}get valueAsNumber(){var t;return this.__numberInput.value=this.value,((t=this.input)==null?void 0:t.valueAsNumber)||this.__numberInput.valueAsNumber}set valueAsNumber(t){this.__numberInput.valueAsNumber=t,this.value=this.__numberInput.value}get validity(){return this.input.validity}get validationMessage(){return this.input.validationMessage}firstUpdated(){this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleChange(){this.value=this.input.value,this.emit("sl-change")}handleClearClick(t){t.preventDefault(),this.value!==""&&(this.value="",this.emit("sl-clear"),this.emit("sl-input"),this.emit("sl-change")),this.input.focus()}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleInput(){this.value=this.input.value,this.formControlController.updateValidity(),this.emit("sl-input")}handleInvalid(t){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(t)}handleKeyDown(t){const e=t.metaKey||t.ctrlKey||t.shiftKey||t.altKey;t.key==="Enter"&&!e&&setTimeout(()=>{!t.defaultPrevented&&!t.isComposing&&this.formControlController.submit()})}handlePasswordToggle(){this.passwordVisible=!this.passwordVisible}handleDisabledChange(){this.formControlController.setValidity(this.disabled)}handleStepChange(){this.input.step=String(this.step),this.formControlController.updateValidity()}async handleValueChange(){await this.updateComplete,this.formControlController.updateValidity()}focus(t){this.input.focus(t)}blur(){this.input.blur()}select(){this.input.select()}setSelectionRange(t,e,o="none"){this.input.setSelectionRange(t,e,o)}setRangeText(t,e,o,i="preserve"){const s=e??this.input.selectionStart,r=o??this.input.selectionEnd;this.input.setRangeText(t,s,r,i),this.value!==this.input.value&&(this.value=this.input.value)}showPicker(){"showPicker"in HTMLInputElement.prototype&&this.input.showPicker()}stepUp(){this.input.stepUp(),this.value!==this.input.value&&(this.value=this.input.value)}stepDown(){this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value)}checkValidity(){return this.input.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.input.reportValidity()}setCustomValidity(t){this.input.setCustomValidity(t),this.formControlController.updateValidity()}render(){const t=this.hasSlotController.test("label"),e=this.hasSlotController.test("help-text"),o=this.label?!0:!!t,i=this.helpText?!0:!!e,r=this.clearable&&!this.disabled&&!this.readonly&&(typeof this.value=="number"||this.value.length>0);return T`
      <div
        part="form-control"
        class=${X({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":o,"form-control--has-help-text":i})}
      >
        <label
          part="form-control-label"
          class="form-control__label"
          for="input"
          aria-hidden=${o?"false":"true"}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <div
            part="base"
            class=${X({input:!0,"input--small":this.size==="small","input--medium":this.size==="medium","input--large":this.size==="large","input--pill":this.pill,"input--standard":!this.filled,"input--filled":this.filled,"input--disabled":this.disabled,"input--focused":this.hasFocus,"input--empty":!this.value,"input--no-spin-buttons":this.noSpinButtons})}
          >
            <span part="prefix" class="input__prefix">
              <slot name="prefix"></slot>
            </span>

            <input
              part="input"
              id="input"
              class="input__control"
              type=${this.type==="password"&&this.passwordVisible?"text":this.type}
              title=${this.title}
              name=${L(this.name)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${L(this.placeholder)}
              minlength=${L(this.minlength)}
              maxlength=${L(this.maxlength)}
              min=${L(this.min)}
              max=${L(this.max)}
              step=${L(this.step)}
              .value=${_o(this.value)}
              autocapitalize=${L(this.autocapitalize)}
              autocomplete=${L(this.autocomplete)}
              autocorrect=${L(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${this.spellcheck}
              pattern=${L(this.pattern)}
              enterkeyhint=${L(this.enterkeyhint)}
              inputmode=${L(this.inputmode)}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @keydown=${this.handleKeyDown}
              @focus=${this.handleFocus}
              @blur=${this.handleBlur}
            />

            ${r?T`
                  <button
                    part="clear-button"
                    class="input__clear"
                    type="button"
                    aria-label=${this.localize.term("clearEntry")}
                    @click=${this.handleClearClick}
                    tabindex="-1"
                  >
                    <slot name="clear-icon">
                      <sl-icon name="x-circle-fill" library="system"></sl-icon>
                    </slot>
                  </button>
                `:""}
            ${this.passwordToggle&&!this.disabled?T`
                  <button
                    part="password-toggle-button"
                    class="input__password-toggle"
                    type="button"
                    aria-label=${this.localize.term(this.passwordVisible?"hidePassword":"showPassword")}
                    @click=${this.handlePasswordToggle}
                    tabindex="-1"
                  >
                    ${this.passwordVisible?T`
                          <slot name="show-password-icon">
                            <sl-icon name="eye-slash" library="system"></sl-icon>
                          </slot>
                        `:T`
                          <slot name="hide-password-icon">
                            <sl-icon name="eye" library="system"></sl-icon>
                          </slot>
                        `}
                  </button>
                `:""}

            <span part="suffix" class="input__suffix">
              <slot name="suffix"></slot>
            </span>
          </div>
        </div>

        <div
          part="form-control-help-text"
          id="help-text"
          class="form-control__help-text"
          aria-hidden=${i?"false":"true"}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `}};S.styles=[tt,Io,Er];S.dependencies={"sl-icon":lt};a([H(".input__control")],S.prototype,"input",2);a([dt()],S.prototype,"hasFocus",2);a([u()],S.prototype,"title",2);a([u({reflect:!0})],S.prototype,"type",2);a([u()],S.prototype,"name",2);a([u()],S.prototype,"value",2);a([Bo()],S.prototype,"defaultValue",2);a([u({reflect:!0})],S.prototype,"size",2);a([u({type:Boolean,reflect:!0})],S.prototype,"filled",2);a([u({type:Boolean,reflect:!0})],S.prototype,"pill",2);a([u()],S.prototype,"label",2);a([u({attribute:"help-text"})],S.prototype,"helpText",2);a([u({type:Boolean})],S.prototype,"clearable",2);a([u({type:Boolean,reflect:!0})],S.prototype,"disabled",2);a([u()],S.prototype,"placeholder",2);a([u({type:Boolean,reflect:!0})],S.prototype,"readonly",2);a([u({attribute:"password-toggle",type:Boolean})],S.prototype,"passwordToggle",2);a([u({attribute:"password-visible",type:Boolean})],S.prototype,"passwordVisible",2);a([u({attribute:"no-spin-buttons",type:Boolean})],S.prototype,"noSpinButtons",2);a([u({reflect:!0})],S.prototype,"form",2);a([u({type:Boolean,reflect:!0})],S.prototype,"required",2);a([u()],S.prototype,"pattern",2);a([u({type:Number})],S.prototype,"minlength",2);a([u({type:Number})],S.prototype,"maxlength",2);a([u()],S.prototype,"min",2);a([u()],S.prototype,"max",2);a([u()],S.prototype,"step",2);a([u()],S.prototype,"autocapitalize",2);a([u()],S.prototype,"autocorrect",2);a([u()],S.prototype,"autocomplete",2);a([u({type:Boolean})],S.prototype,"autofocus",2);a([u()],S.prototype,"enterkeyhint",2);a([u({type:Boolean,converter:{fromAttribute:t=>!(!t||t==="false"),toAttribute:t=>t?"true":"false"}})],S.prototype,"spellcheck",2);a([u()],S.prototype,"inputmode",2);a([N("disabled",{waitUntilFirstUpdate:!0})],S.prototype,"handleDisabledChange",1);a([N("step",{waitUntilFirstUpdate:!0})],S.prototype,"handleStepChange",1);a([N("value",{waitUntilFirstUpdate:!0})],S.prototype,"handleValueChange",1);S.define("sl-input");var Tr=G`
  :host {
    display: block;
    user-select: none;
    -webkit-user-select: none;
  }

  :host(:focus) {
    outline: none;
  }

  .option {
    position: relative;
    display: flex;
    align-items: center;
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-medium);
    font-weight: var(--sl-font-weight-normal);
    line-height: var(--sl-line-height-normal);
    letter-spacing: var(--sl-letter-spacing-normal);
    color: var(--sl-color-neutral-700);
    padding: var(--sl-spacing-x-small) var(--sl-spacing-medium) var(--sl-spacing-x-small) var(--sl-spacing-x-small);
    transition: var(--sl-transition-fast) fill;
    cursor: pointer;
  }

  .option--hover:not(.option--current):not(.option--disabled) {
    background-color: var(--sl-color-neutral-100);
    color: var(--sl-color-neutral-1000);
  }

  .option--current,
  .option--current.option--disabled {
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
    opacity: 1;
  }

  .option--disabled {
    outline: none;
    opacity: 0.5;
    cursor: not-allowed;
  }

  .option__label {
    flex: 1 1 auto;
    display: inline-block;
    line-height: var(--sl-line-height-dense);
  }

  .option .option__check {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    visibility: hidden;
    padding-inline-end: var(--sl-spacing-2x-small);
  }

  .option--selected .option__check {
    visibility: visible;
  }

  .option__prefix,
  .option__suffix {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .option__prefix::slotted(*) {
    margin-inline-end: var(--sl-spacing-x-small);
  }

  .option__suffix::slotted(*) {
    margin-inline-start: var(--sl-spacing-x-small);
  }

  @media (forced-colors: active) {
    :host(:hover:not([aria-disabled='true'])) .option {
      outline: dashed 1px SelectedItem;
      outline-offset: -1px;
    }
  }
`,wt=class extends q{constructor(){super(...arguments),this.localize=new Et(this),this.current=!1,this.selected=!1,this.hasHover=!1,this.value="",this.disabled=!1}connectedCallback(){super.connectedCallback(),this.setAttribute("role","option"),this.setAttribute("aria-selected","false")}handleDefaultSlotChange(){const t=this.getTextLabel();if(typeof this.cachedTextLabel>"u"){this.cachedTextLabel=t;return}t!==this.cachedTextLabel&&(this.cachedTextLabel=t,this.emit("slotchange",{bubbles:!0,composed:!1,cancelable:!1}))}handleMouseEnter(){this.hasHover=!0}handleMouseLeave(){this.hasHover=!1}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false")}handleSelectedChange(){this.setAttribute("aria-selected",this.selected?"true":"false")}handleValueChange(){typeof this.value!="string"&&(this.value=String(this.value)),this.value.includes(" ")&&(console.error("Option values cannot include a space. All spaces have been replaced with underscores.",this),this.value=this.value.replace(/ /g,"_"))}getTextLabel(){const t=this.childNodes;let e="";return[...t].forEach(o=>{o.nodeType===Node.ELEMENT_NODE&&(o.hasAttribute("slot")||(e+=o.textContent)),o.nodeType===Node.TEXT_NODE&&(e+=o.textContent)}),e.trim()}render(){return T`
      <div
        part="base"
        class=${X({option:!0,"option--current":this.current,"option--disabled":this.disabled,"option--selected":this.selected,"option--hover":this.hasHover})}
        @mouseenter=${this.handleMouseEnter}
        @mouseleave=${this.handleMouseLeave}
      >
        <sl-icon part="checked-icon" class="option__check" name="check" library="system" aria-hidden="true"></sl-icon>
        <slot part="prefix" name="prefix" class="option__prefix"></slot>
        <slot part="label" class="option__label" @slotchange=${this.handleDefaultSlotChange}></slot>
        <slot part="suffix" name="suffix" class="option__suffix"></slot>
      </div>
    `}};wt.styles=[tt,Tr];wt.dependencies={"sl-icon":lt};a([H(".option__label")],wt.prototype,"defaultSlot",2);a([dt()],wt.prototype,"current",2);a([dt()],wt.prototype,"selected",2);a([dt()],wt.prototype,"hasHover",2);a([u({reflect:!0})],wt.prototype,"value",2);a([u({type:Boolean,reflect:!0})],wt.prototype,"disabled",2);a([N("disabled")],wt.prototype,"handleDisabledChange",1);a([N("selected")],wt.prototype,"handleSelectedChange",1);a([N("value")],wt.prototype,"handleValueChange",1);wt.define("sl-option");var zr=G`
  :host {
    display: inline-block;
  }

  .tag {
    display: flex;
    align-items: center;
    border: solid 1px;
    line-height: 1;
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
  }

  .tag__remove::part(base) {
    color: inherit;
    padding: 0;
  }

  /*
   * Variant modifiers
   */

  .tag--primary {
    background-color: var(--sl-color-primary-50);
    border-color: var(--sl-color-primary-200);
    color: var(--sl-color-primary-800);
  }

  .tag--primary:active > sl-icon-button {
    color: var(--sl-color-primary-600);
  }

  .tag--success {
    background-color: var(--sl-color-success-50);
    border-color: var(--sl-color-success-200);
    color: var(--sl-color-success-800);
  }

  .tag--success:active > sl-icon-button {
    color: var(--sl-color-success-600);
  }

  .tag--neutral {
    background-color: var(--sl-color-neutral-50);
    border-color: var(--sl-color-neutral-200);
    color: var(--sl-color-neutral-800);
  }

  .tag--neutral:active > sl-icon-button {
    color: var(--sl-color-neutral-600);
  }

  .tag--warning {
    background-color: var(--sl-color-warning-50);
    border-color: var(--sl-color-warning-200);
    color: var(--sl-color-warning-800);
  }

  .tag--warning:active > sl-icon-button {
    color: var(--sl-color-warning-600);
  }

  .tag--danger {
    background-color: var(--sl-color-danger-50);
    border-color: var(--sl-color-danger-200);
    color: var(--sl-color-danger-800);
  }

  .tag--danger:active > sl-icon-button {
    color: var(--sl-color-danger-600);
  }

  /*
   * Size modifiers
   */

  .tag--small {
    font-size: var(--sl-button-font-size-small);
    height: calc(var(--sl-input-height-small) * 0.8);
    line-height: calc(var(--sl-input-height-small) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-small);
    padding: 0 var(--sl-spacing-x-small);
  }

  .tag--medium {
    font-size: var(--sl-button-font-size-medium);
    height: calc(var(--sl-input-height-medium) * 0.8);
    line-height: calc(var(--sl-input-height-medium) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-medium);
    padding: 0 var(--sl-spacing-small);
  }

  .tag--large {
    font-size: var(--sl-button-font-size-large);
    height: calc(var(--sl-input-height-large) * 0.8);
    line-height: calc(var(--sl-input-height-large) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-large);
    padding: 0 var(--sl-spacing-medium);
  }

  .tag__remove {
    margin-inline-start: var(--sl-spacing-x-small);
  }

  /*
   * Pill modifier
   */

  .tag--pill {
    border-radius: var(--sl-border-radius-pill);
  }
`,qt=class extends q{constructor(){super(...arguments),this.localize=new Et(this),this.variant="neutral",this.size="medium",this.pill=!1,this.removable=!1}handleRemoveClick(){this.emit("sl-remove")}render(){return T`
      <span
        part="base"
        class=${X({tag:!0,"tag--primary":this.variant==="primary","tag--success":this.variant==="success","tag--neutral":this.variant==="neutral","tag--warning":this.variant==="warning","tag--danger":this.variant==="danger","tag--text":this.variant==="text","tag--small":this.size==="small","tag--medium":this.size==="medium","tag--large":this.size==="large","tag--pill":this.pill,"tag--removable":this.removable})}
      >
        <slot part="content" class="tag__content"></slot>

        ${this.removable?T`
              <sl-icon-button
                part="remove-button"
                exportparts="base:remove-button__base"
                name="x-lg"
                library="system"
                label=${this.localize.term("remove")}
                class="tag__remove"
                @click=${this.handleRemoveClick}
                tabindex="-1"
              ></sl-icon-button>
            `:""}
      </span>
    `}};qt.styles=[tt,zr];qt.dependencies={"sl-icon-button":ot};a([u({reflect:!0})],qt.prototype,"variant",2);a([u({reflect:!0})],qt.prototype,"size",2);a([u({type:Boolean,reflect:!0})],qt.prototype,"pill",2);a([u({type:Boolean})],qt.prototype,"removable",2);var Lr=G`
  :host {
    display: block;
  }

  /** The popup */
  .select {
    flex: 1 1 auto;
    display: inline-flex;
    width: 100%;
    position: relative;
    vertical-align: middle;
  }

  .select::part(popup) {
    z-index: var(--sl-z-index-dropdown);
  }

  .select[data-current-placement^='top']::part(popup) {
    transform-origin: bottom;
  }

  .select[data-current-placement^='bottom']::part(popup) {
    transform-origin: top;
  }

  /* Combobox */
  .select__combobox {
    flex: 1;
    display: flex;
    width: 100%;
    min-width: 0;
    position: relative;
    align-items: center;
    justify-content: start;
    font-family: var(--sl-input-font-family);
    font-weight: var(--sl-input-font-weight);
    letter-spacing: var(--sl-input-letter-spacing);
    vertical-align: middle;
    overflow: hidden;
    cursor: pointer;
    transition:
      var(--sl-transition-fast) color,
      var(--sl-transition-fast) border,
      var(--sl-transition-fast) box-shadow,
      var(--sl-transition-fast) background-color;
  }

  .select__display-input {
    position: relative;
    width: 100%;
    font: inherit;
    border: none;
    background: none;
    color: var(--sl-input-color);
    cursor: inherit;
    overflow: hidden;
    padding: 0;
    margin: 0;
    -webkit-appearance: none;
  }

  .select__display-input::placeholder {
    color: var(--sl-input-placeholder-color);
  }

  .select:not(.select--disabled):hover .select__display-input {
    color: var(--sl-input-color-hover);
  }

  .select__display-input:focus {
    outline: none;
  }

  /* Visually hide the display input when multiple is enabled */
  .select--multiple:not(.select--placeholder-visible) .select__display-input {
    position: absolute;
    z-index: -1;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
  }

  .select__value-input {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    opacity: 0;
    z-index: -1;
  }

  .select__tags {
    display: flex;
    flex: 1;
    align-items: center;
    flex-wrap: wrap;
    margin-inline-start: var(--sl-spacing-2x-small);
  }

  .select__tags::slotted(sl-tag) {
    cursor: pointer !important;
  }

  .select--disabled .select__tags,
  .select--disabled .select__tags::slotted(sl-tag) {
    cursor: not-allowed !important;
  }

  /* Standard selects */
  .select--standard .select__combobox {
    background-color: var(--sl-input-background-color);
    border: solid var(--sl-input-border-width) var(--sl-input-border-color);
  }

  .select--standard.select--disabled .select__combobox {
    background-color: var(--sl-input-background-color-disabled);
    border-color: var(--sl-input-border-color-disabled);
    color: var(--sl-input-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
    outline: none;
  }

  .select--standard:not(.select--disabled).select--open .select__combobox,
  .select--standard:not(.select--disabled).select--focused .select__combobox {
    background-color: var(--sl-input-background-color-focus);
    border-color: var(--sl-input-border-color-focus);
    box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-input-focus-ring-color);
  }

  /* Filled selects */
  .select--filled .select__combobox {
    border: none;
    background-color: var(--sl-input-filled-background-color);
    color: var(--sl-input-color);
  }

  .select--filled:hover:not(.select--disabled) .select__combobox {
    background-color: var(--sl-input-filled-background-color-hover);
  }

  .select--filled.select--disabled .select__combobox {
    background-color: var(--sl-input-filled-background-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .select--filled:not(.select--disabled).select--open .select__combobox,
  .select--filled:not(.select--disabled).select--focused .select__combobox {
    background-color: var(--sl-input-filled-background-color-focus);
    outline: var(--sl-focus-ring);
  }

  /* Sizes */
  .select--small .select__combobox {
    border-radius: var(--sl-input-border-radius-small);
    font-size: var(--sl-input-font-size-small);
    min-height: var(--sl-input-height-small);
    padding-block: 0;
    padding-inline: var(--sl-input-spacing-small);
  }

  .select--small .select__clear {
    margin-inline-start: var(--sl-input-spacing-small);
  }

  .select--small .select__prefix::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-small);
  }

  .select--small.select--multiple:not(.select--placeholder-visible) .select__combobox {
    padding-block: 2px;
    padding-inline-start: 0;
  }

  .select--small .select__tags {
    gap: 2px;
  }

  .select--medium .select__combobox {
    border-radius: var(--sl-input-border-radius-medium);
    font-size: var(--sl-input-font-size-medium);
    min-height: var(--sl-input-height-medium);
    padding-block: 0;
    padding-inline: var(--sl-input-spacing-medium);
  }

  .select--medium .select__clear {
    margin-inline-start: var(--sl-input-spacing-medium);
  }

  .select--medium .select__prefix::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-medium);
  }

  .select--medium.select--multiple:not(.select--placeholder-visible) .select__combobox {
    padding-inline-start: 0;
    padding-block: 3px;
  }

  .select--medium .select__tags {
    gap: 3px;
  }

  .select--large .select__combobox {
    border-radius: var(--sl-input-border-radius-large);
    font-size: var(--sl-input-font-size-large);
    min-height: var(--sl-input-height-large);
    padding-block: 0;
    padding-inline: var(--sl-input-spacing-large);
  }

  .select--large .select__clear {
    margin-inline-start: var(--sl-input-spacing-large);
  }

  .select--large .select__prefix::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-large);
  }

  .select--large.select--multiple:not(.select--placeholder-visible) .select__combobox {
    padding-inline-start: 0;
    padding-block: 4px;
  }

  .select--large .select__tags {
    gap: 4px;
  }

  /* Pills */
  .select--pill.select--small .select__combobox {
    border-radius: var(--sl-input-height-small);
  }

  .select--pill.select--medium .select__combobox {
    border-radius: var(--sl-input-height-medium);
  }

  .select--pill.select--large .select__combobox {
    border-radius: var(--sl-input-height-large);
  }

  /* Prefix */
  .select__prefix {
    flex: 0;
    display: inline-flex;
    align-items: center;
    color: var(--sl-input-placeholder-color);
  }

  /* Clear button */
  .select__clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: inherit;
    color: var(--sl-input-icon-color);
    border: none;
    background: none;
    padding: 0;
    transition: var(--sl-transition-fast) color;
    cursor: pointer;
  }

  .select__clear:hover {
    color: var(--sl-input-icon-color-hover);
  }

  .select__clear:focus {
    outline: none;
  }

  /* Expand icon */
  .select__expand-icon {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    transition: var(--sl-transition-medium) rotate ease;
    rotate: 0;
    margin-inline-start: var(--sl-spacing-small);
  }

  .select--open .select__expand-icon {
    rotate: -180deg;
  }

  /* Listbox */
  .select__listbox {
    display: block;
    position: relative;
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-medium);
    font-weight: var(--sl-font-weight-normal);
    box-shadow: var(--sl-shadow-large);
    background: var(--sl-panel-background-color);
    border: solid var(--sl-panel-border-width) var(--sl-panel-border-color);
    border-radius: var(--sl-border-radius-medium);
    padding-block: var(--sl-spacing-x-small);
    padding-inline: 0;
    overflow: auto;
    overscroll-behavior: none;

    /* Make sure it adheres to the popup's auto size */
    max-width: var(--auto-size-available-width);
    max-height: var(--auto-size-available-height);
  }

  .select__listbox ::slotted(sl-divider) {
    --spacing: var(--sl-spacing-x-small);
  }

  .select__listbox ::slotted(small) {
    font-size: var(--sl-font-size-small);
    font-weight: var(--sl-font-weight-semibold);
    color: var(--sl-color-neutral-500);
    padding-block: var(--sl-spacing-x-small);
    padding-inline: var(--sl-spacing-x-large);
  }
`,Or=G`
  :host {
    --arrow-color: var(--sl-color-neutral-1000);
    --arrow-size: 6px;

    /*
     * These properties are computed to account for the arrow's dimensions after being rotated 45º. The constant
     * 0.7071 is derived from sin(45), which is the diagonal size of the arrow's container after rotating.
     */
    --arrow-size-diagonal: calc(var(--arrow-size) * 0.7071);
    --arrow-padding-offset: calc(var(--arrow-size-diagonal) - var(--arrow-size));

    display: contents;
  }

  .popup {
    position: absolute;
    isolation: isolate;
    max-width: var(--auto-size-available-width, none);
    max-height: var(--auto-size-available-height, none);
  }

  .popup--fixed {
    position: fixed;
  }

  .popup:not(.popup--active) {
    display: none;
  }

  .popup__arrow {
    position: absolute;
    width: calc(var(--arrow-size-diagonal) * 2);
    height: calc(var(--arrow-size-diagonal) * 2);
    rotate: 45deg;
    background: var(--arrow-color);
    z-index: -1;
  }

  /* Hover bridge */
  .popup-hover-bridge:not(.popup-hover-bridge--visible) {
    display: none;
  }

  .popup-hover-bridge {
    position: fixed;
    z-index: calc(var(--sl-z-index-dropdown) - 1);
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    clip-path: polygon(
      var(--hover-bridge-top-left-x, 0) var(--hover-bridge-top-left-y, 0),
      var(--hover-bridge-top-right-x, 0) var(--hover-bridge-top-right-y, 0),
      var(--hover-bridge-bottom-right-x, 0) var(--hover-bridge-bottom-right-y, 0),
      var(--hover-bridge-bottom-left-x, 0) var(--hover-bridge-bottom-left-y, 0)
    );
  }
`;const Ht=Math.min,mt=Math.max,Ue=Math.round,Re=Math.floor,zt=t=>({x:t,y:t}),Pr={left:"right",right:"left",bottom:"top",top:"bottom"};function ko(t,e,o){return mt(t,Ht(e,o))}function de(t,e){return typeof t=="function"?t(e):t}function Ut(t){return t.split("-")[0]}function ue(t){return t.split("-")[1]}function Xi(t){return t==="x"?"y":"x"}function Mo(t){return t==="y"?"height":"width"}function Rt(t){const e=t[0];return e==="t"||e==="b"?"y":"x"}function No(t){return Xi(Rt(t))}function Dr(t,e,o){o===void 0&&(o=!1);const i=ue(t),s=No(t),r=Mo(s);let n=s==="x"?i===(o?"end":"start")?"right":"left":i==="start"?"bottom":"top";return e.reference[r]>e.floating[r]&&(n=We(n)),[n,We(n)]}function Rr(t){const e=We(t);return[Co(t),e,Co(e)]}function Co(t){return t.includes("start")?t.replace("start","end"):t.replace("end","start")}const $i=["left","right"],Ai=["right","left"],Br=["top","bottom"],Ir=["bottom","top"];function Fr(t,e,o){switch(t){case"top":case"bottom":return o?e?Ai:$i:e?$i:Ai;case"left":case"right":return e?Br:Ir;default:return[]}}function Mr(t,e,o,i){const s=ue(t);let r=Fr(Ut(t),o==="start",i);return s&&(r=r.map(n=>n+"-"+s),e&&(r=r.concat(r.map(Co)))),r}function We(t){const e=Ut(t);return Pr[e]+t.slice(e.length)}function Nr(t){return{top:0,right:0,bottom:0,left:0,...t}}function Gi(t){return typeof t!="number"?Nr(t):{top:t,right:t,bottom:t,left:t}}function je(t){const{x:e,y:o,width:i,height:s}=t;return{width:i,height:s,top:o,left:e,right:e+i,bottom:o+s,x:e,y:o}}function Si(t,e,o){let{reference:i,floating:s}=t;const r=Rt(e),n=No(e),l=Mo(n),c=Ut(e),p=r==="y",b=i.x+i.width/2-s.width/2,f=i.y+i.height/2-s.height/2,y=i[l]/2-s[l]/2;let v;switch(c){case"top":v={x:b,y:i.y-s.height};break;case"bottom":v={x:b,y:i.y+i.height};break;case"right":v={x:i.x+i.width,y:f};break;case"left":v={x:i.x-s.width,y:f};break;default:v={x:i.x,y:i.y}}switch(ue(e)){case"start":v[n]-=y*(o&&p?-1:1);break;case"end":v[n]+=y*(o&&p?-1:1);break}return v}async function Vr(t,e){var o;e===void 0&&(e={});const{x:i,y:s,platform:r,rects:n,elements:l,strategy:c}=t,{boundary:p="clippingAncestors",rootBoundary:b="viewport",elementContext:f="floating",altBoundary:y=!1,padding:v=0}=de(e,t),w=Gi(v),C=l[y?f==="floating"?"reference":"floating":f],x=je(await r.getClippingRect({element:(o=await(r.isElement==null?void 0:r.isElement(C)))==null||o?C:C.contextElement||await(r.getDocumentElement==null?void 0:r.getDocumentElement(l.floating)),boundary:p,rootBoundary:b,strategy:c})),$=f==="floating"?{x:i,y:s,width:n.floating.width,height:n.floating.height}:n.reference,z=await(r.getOffsetParent==null?void 0:r.getOffsetParent(l.floating)),O=await(r.isElement==null?void 0:r.isElement(z))?await(r.getScale==null?void 0:r.getScale(z))||{x:1,y:1}:{x:1,y:1},V=je(r.convertOffsetParentRelativeRectToViewportRelativeRect?await r.convertOffsetParentRelativeRectToViewportRelativeRect({elements:l,rect:$,offsetParent:z,strategy:c}):$);return{top:(x.top-V.top+w.top)/O.y,bottom:(V.bottom-x.bottom+w.bottom)/O.y,left:(x.left-V.left+w.left)/O.x,right:(V.right-x.right+w.right)/O.x}}const Hr=50,Ur=async(t,e,o)=>{const{placement:i="bottom",strategy:s="absolute",middleware:r=[],platform:n}=o,l=n.detectOverflow?n:{...n,detectOverflow:Vr},c=await(n.isRTL==null?void 0:n.isRTL(e));let p=await n.getElementRects({reference:t,floating:e,strategy:s}),{x:b,y:f}=Si(p,i,c),y=i,v=0;const w={};for(let k=0;k<r.length;k++){const C=r[k];if(!C)continue;const{name:x,fn:$}=C,{x:z,y:O,data:V,reset:A}=await $({x:b,y:f,initialPlacement:i,placement:y,strategy:s,middlewareData:w,rects:p,platform:l,elements:{reference:t,floating:e}});b=z??b,f=O??f,w[x]={...w[x],...V},A&&v<Hr&&(v++,typeof A=="object"&&(A.placement&&(y=A.placement),A.rects&&(p=A.rects===!0?await n.getElementRects({reference:t,floating:e,strategy:s}):A.rects),{x:b,y:f}=Si(p,y,c)),k=-1)}return{x:b,y:f,placement:y,strategy:s,middlewareData:w}},Wr=t=>({name:"arrow",options:t,async fn(e){const{x:o,y:i,placement:s,rects:r,platform:n,elements:l,middlewareData:c}=e,{element:p,padding:b=0}=de(t,e)||{};if(p==null)return{};const f=Gi(b),y={x:o,y:i},v=No(s),w=Mo(v),k=await n.getDimensions(p),C=v==="y",x=C?"top":"left",$=C?"bottom":"right",z=C?"clientHeight":"clientWidth",O=r.reference[w]+r.reference[v]-y[v]-r.floating[w],V=y[v]-r.reference[v],A=await(n.getOffsetParent==null?void 0:n.getOffsetParent(p));let E=A?A[z]:0;(!E||!await(n.isElement==null?void 0:n.isElement(A)))&&(E=l.floating[z]||r.floating[w]);const at=O/2-V/2,st=E/2-k[w]/2-1,J=Ht(f[x],st),ut=Ht(f[$],st),ct=J,ht=E-k[w]-ut,U=E/2-k[w]/2+at,yt=ko(ct,U,ht),M=!c.arrow&&ue(s)!=null&&U!==yt&&r.reference[w]/2-(U<ct?J:ut)-k[w]/2<0,K=M?U<ct?U-ct:U-ht:0;return{[v]:y[v]+K,data:{[v]:yt,centerOffset:U-yt-K,...M&&{alignmentOffset:K}},reset:M}}}),jr=function(t){return t===void 0&&(t={}),{name:"flip",options:t,async fn(e){var o,i;const{placement:s,middlewareData:r,rects:n,initialPlacement:l,platform:c,elements:p}=e,{mainAxis:b=!0,crossAxis:f=!0,fallbackPlacements:y,fallbackStrategy:v="bestFit",fallbackAxisSideDirection:w="none",flipAlignment:k=!0,...C}=de(t,e);if((o=r.arrow)!=null&&o.alignmentOffset)return{};const x=Ut(s),$=Rt(l),z=Ut(l)===l,O=await(c.isRTL==null?void 0:c.isRTL(p.floating)),V=y||(z||!k?[We(l)]:Rr(l)),A=w!=="none";!y&&A&&V.push(...Mr(l,k,w,O));const E=[l,...V],at=await c.detectOverflow(e,C),st=[];let J=((i=r.flip)==null?void 0:i.overflows)||[];if(b&&st.push(at[x]),f){const U=Dr(s,n,O);st.push(at[U[0]],at[U[1]])}if(J=[...J,{placement:s,overflows:st}],!st.every(U=>U<=0)){var ut,ct;const U=(((ut=r.flip)==null?void 0:ut.index)||0)+1,yt=E[U];if(yt&&(!(f==="alignment"?$!==Rt(yt):!1)||J.every(B=>Rt(B.placement)===$?B.overflows[0]>0:!0)))return{data:{index:U,overflows:J},reset:{placement:yt}};let M=(ct=J.filter(K=>K.overflows[0]<=0).sort((K,B)=>K.overflows[1]-B.overflows[1])[0])==null?void 0:ct.placement;if(!M)switch(v){case"bestFit":{var ht;const K=(ht=J.filter(B=>{if(A){const xt=Rt(B.placement);return xt===$||xt==="y"}return!0}).map(B=>[B.placement,B.overflows.filter(xt=>xt>0).reduce((xt,Qe)=>xt+Qe,0)]).sort((B,xt)=>B[1]-xt[1])[0])==null?void 0:ht[0];K&&(M=K);break}case"initialPlacement":M=l;break}if(s!==M)return{reset:{placement:M}}}return{}}}},qr=new Set(["left","top"]);async function Kr(t,e){const{placement:o,platform:i,elements:s}=t,r=await(i.isRTL==null?void 0:i.isRTL(s.floating)),n=Ut(o),l=ue(o),c=Rt(o)==="y",p=qr.has(n)?-1:1,b=r&&c?-1:1,f=de(e,t);let{mainAxis:y,crossAxis:v,alignmentAxis:w}=typeof f=="number"?{mainAxis:f,crossAxis:0,alignmentAxis:null}:{mainAxis:f.mainAxis||0,crossAxis:f.crossAxis||0,alignmentAxis:f.alignmentAxis};return l&&typeof w=="number"&&(v=l==="end"?w*-1:w),c?{x:v*b,y:y*p}:{x:y*p,y:v*b}}const Yr=function(t){return t===void 0&&(t=0),{name:"offset",options:t,async fn(e){var o,i;const{x:s,y:r,placement:n,middlewareData:l}=e,c=await Kr(e,t);return n===((o=l.offset)==null?void 0:o.placement)&&(i=l.arrow)!=null&&i.alignmentOffset?{}:{x:s+c.x,y:r+c.y,data:{...c,placement:n}}}}},Xr=function(t){return t===void 0&&(t={}),{name:"shift",options:t,async fn(e){const{x:o,y:i,placement:s,platform:r}=e,{mainAxis:n=!0,crossAxis:l=!1,limiter:c={fn:x=>{let{x:$,y:z}=x;return{x:$,y:z}}},...p}=de(t,e),b={x:o,y:i},f=await r.detectOverflow(e,p),y=Rt(Ut(s)),v=Xi(y);let w=b[v],k=b[y];if(n){const x=v==="y"?"top":"left",$=v==="y"?"bottom":"right",z=w+f[x],O=w-f[$];w=ko(z,w,O)}if(l){const x=y==="y"?"top":"left",$=y==="y"?"bottom":"right",z=k+f[x],O=k-f[$];k=ko(z,k,O)}const C=c.fn({...e,[v]:w,[y]:k});return{...C,data:{x:C.x-o,y:C.y-i,enabled:{[v]:n,[y]:l}}}}}},Gr=function(t){return t===void 0&&(t={}),{name:"size",options:t,async fn(e){var o,i;const{placement:s,rects:r,platform:n,elements:l}=e,{apply:c=()=>{},...p}=de(t,e),b=await n.detectOverflow(e,p),f=Ut(s),y=ue(s),v=Rt(s)==="y",{width:w,height:k}=r.floating;let C,x;f==="top"||f==="bottom"?(C=f,x=y===(await(n.isRTL==null?void 0:n.isRTL(l.floating))?"start":"end")?"left":"right"):(x=f,C=y==="end"?"top":"bottom");const $=k-b.top-b.bottom,z=w-b.left-b.right,O=Ht(k-b[C],$),V=Ht(w-b[x],z),A=!e.middlewareData.shift;let E=O,at=V;if((o=e.middlewareData.shift)!=null&&o.enabled.x&&(at=z),(i=e.middlewareData.shift)!=null&&i.enabled.y&&(E=$),A&&!y){const J=mt(b.left,0),ut=mt(b.right,0),ct=mt(b.top,0),ht=mt(b.bottom,0);v?at=w-2*(J!==0||ut!==0?J+ut:mt(b.left,b.right)):E=k-2*(ct!==0||ht!==0?ct+ht:mt(b.top,b.bottom))}await c({...e,availableWidth:at,availableHeight:E});const st=await n.getDimensions(l.floating);return w!==st.width||k!==st.height?{reset:{rects:!0}}:{}}}};function Xe(){return typeof window<"u"}function he(t){return Ji(t)?(t.nodeName||"").toLowerCase():"#document"}function gt(t){var e;return(t==null||(e=t.ownerDocument)==null?void 0:e.defaultView)||window}function Pt(t){var e;return(e=(Ji(t)?t.ownerDocument:t.document)||window.document)==null?void 0:e.documentElement}function Ji(t){return Xe()?t instanceof Node||t instanceof gt(t).Node:!1}function $t(t){return Xe()?t instanceof Element||t instanceof gt(t).Element:!1}function Bt(t){return Xe()?t instanceof HTMLElement||t instanceof gt(t).HTMLElement:!1}function Ei(t){return!Xe()||typeof ShadowRoot>"u"?!1:t instanceof ShadowRoot||t instanceof gt(t).ShadowRoot}function Te(t){const{overflow:e,overflowX:o,overflowY:i,display:s}=At(t);return/auto|scroll|overlay|hidden|clip/.test(e+i+o)&&s!=="inline"&&s!=="contents"}function Jr(t){return/^(table|td|th)$/.test(he(t))}function Ge(t){try{if(t.matches(":popover-open"))return!0}catch{}try{return t.matches(":modal")}catch{return!1}}const Zr=/transform|translate|scale|rotate|perspective|filter/,Qr=/paint|layout|strict|content/,Xt=t=>!!t&&t!=="none";let bo;function Vo(t){const e=$t(t)?At(t):t;return Xt(e.transform)||Xt(e.translate)||Xt(e.scale)||Xt(e.rotate)||Xt(e.perspective)||!Ho()&&(Xt(e.backdropFilter)||Xt(e.filter))||Zr.test(e.willChange||"")||Qr.test(e.contain||"")}function tn(t){let e=Wt(t);for(;Bt(e)&&!ce(e);){if(Vo(e))return e;if(Ge(e))return null;e=Wt(e)}return null}function Ho(){return bo==null&&(bo=typeof CSS<"u"&&CSS.supports&&CSS.supports("-webkit-backdrop-filter","none")),bo}function ce(t){return/^(html|body|#document)$/.test(he(t))}function At(t){return gt(t).getComputedStyle(t)}function Je(t){return $t(t)?{scrollLeft:t.scrollLeft,scrollTop:t.scrollTop}:{scrollLeft:t.scrollX,scrollTop:t.scrollY}}function Wt(t){if(he(t)==="html")return t;const e=t.assignedSlot||t.parentNode||Ei(t)&&t.host||Pt(t);return Ei(e)?e.host:e}function Zi(t){const e=Wt(t);return ce(e)?t.ownerDocument?t.ownerDocument.body:t.body:Bt(e)&&Te(e)?e:Zi(e)}function Se(t,e,o){var i;e===void 0&&(e=[]),o===void 0&&(o=!0);const s=Zi(t),r=s===((i=t.ownerDocument)==null?void 0:i.body),n=gt(s);if(r){const l=$o(n);return e.concat(n,n.visualViewport||[],Te(s)?s:[],l&&o?Se(l):[])}else return e.concat(s,Se(s,[],o))}function $o(t){return t.parent&&Object.getPrototypeOf(t.parent)?t.frameElement:null}function Qi(t){const e=At(t);let o=parseFloat(e.width)||0,i=parseFloat(e.height)||0;const s=Bt(t),r=s?t.offsetWidth:o,n=s?t.offsetHeight:i,l=Ue(o)!==r||Ue(i)!==n;return l&&(o=r,i=n),{width:o,height:i,$:l}}function Uo(t){return $t(t)?t:t.contextElement}function ne(t){const e=Uo(t);if(!Bt(e))return zt(1);const o=e.getBoundingClientRect(),{width:i,height:s,$:r}=Qi(e);let n=(r?Ue(o.width):o.width)/i,l=(r?Ue(o.height):o.height)/s;return(!n||!Number.isFinite(n))&&(n=1),(!l||!Number.isFinite(l))&&(l=1),{x:n,y:l}}const en=zt(0);function ts(t){const e=gt(t);return!Ho()||!e.visualViewport?en:{x:e.visualViewport.offsetLeft,y:e.visualViewport.offsetTop}}function on(t,e,o){return e===void 0&&(e=!1),!o||e&&o!==gt(t)?!1:e}function te(t,e,o,i){e===void 0&&(e=!1),o===void 0&&(o=!1);const s=t.getBoundingClientRect(),r=Uo(t);let n=zt(1);e&&(i?$t(i)&&(n=ne(i)):n=ne(t));const l=on(r,o,i)?ts(r):zt(0);let c=(s.left+l.x)/n.x,p=(s.top+l.y)/n.y,b=s.width/n.x,f=s.height/n.y;if(r){const y=gt(r),v=i&&$t(i)?gt(i):i;let w=y,k=$o(w);for(;k&&i&&v!==w;){const C=ne(k),x=k.getBoundingClientRect(),$=At(k),z=x.left+(k.clientLeft+parseFloat($.paddingLeft))*C.x,O=x.top+(k.clientTop+parseFloat($.paddingTop))*C.y;c*=C.x,p*=C.y,b*=C.x,f*=C.y,c+=z,p+=O,w=gt(k),k=$o(w)}}return je({width:b,height:f,x:c,y:p})}function Ze(t,e){const o=Je(t).scrollLeft;return e?e.left+o:te(Pt(t)).left+o}function es(t,e){const o=t.getBoundingClientRect(),i=o.left+e.scrollLeft-Ze(t,o),s=o.top+e.scrollTop;return{x:i,y:s}}function sn(t){let{elements:e,rect:o,offsetParent:i,strategy:s}=t;const r=s==="fixed",n=Pt(i),l=e?Ge(e.floating):!1;if(i===n||l&&r)return o;let c={scrollLeft:0,scrollTop:0},p=zt(1);const b=zt(0),f=Bt(i);if((f||!f&&!r)&&((he(i)!=="body"||Te(n))&&(c=Je(i)),f)){const v=te(i);p=ne(i),b.x=v.x+i.clientLeft,b.y=v.y+i.clientTop}const y=n&&!f&&!r?es(n,c):zt(0);return{width:o.width*p.x,height:o.height*p.y,x:o.x*p.x-c.scrollLeft*p.x+b.x+y.x,y:o.y*p.y-c.scrollTop*p.y+b.y+y.y}}function rn(t){return Array.from(t.getClientRects())}function nn(t){const e=Pt(t),o=Je(t),i=t.ownerDocument.body,s=mt(e.scrollWidth,e.clientWidth,i.scrollWidth,i.clientWidth),r=mt(e.scrollHeight,e.clientHeight,i.scrollHeight,i.clientHeight);let n=-o.scrollLeft+Ze(t);const l=-o.scrollTop;return At(i).direction==="rtl"&&(n+=mt(e.clientWidth,i.clientWidth)-s),{width:s,height:r,x:n,y:l}}const Ti=25;function an(t,e){const o=gt(t),i=Pt(t),s=o.visualViewport;let r=i.clientWidth,n=i.clientHeight,l=0,c=0;if(s){r=s.width,n=s.height;const b=Ho();(!b||b&&e==="fixed")&&(l=s.offsetLeft,c=s.offsetTop)}const p=Ze(i);if(p<=0){const b=i.ownerDocument,f=b.body,y=getComputedStyle(f),v=b.compatMode==="CSS1Compat"&&parseFloat(y.marginLeft)+parseFloat(y.marginRight)||0,w=Math.abs(i.clientWidth-f.clientWidth-v);w<=Ti&&(r-=w)}else p<=Ti&&(r+=p);return{width:r,height:n,x:l,y:c}}function ln(t,e){const o=te(t,!0,e==="fixed"),i=o.top+t.clientTop,s=o.left+t.clientLeft,r=Bt(t)?ne(t):zt(1),n=t.clientWidth*r.x,l=t.clientHeight*r.y,c=s*r.x,p=i*r.y;return{width:n,height:l,x:c,y:p}}function zi(t,e,o){let i;if(e==="viewport")i=an(t,o);else if(e==="document")i=nn(Pt(t));else if($t(e))i=ln(e,o);else{const s=ts(t);i={x:e.x-s.x,y:e.y-s.y,width:e.width,height:e.height}}return je(i)}function os(t,e){const o=Wt(t);return o===e||!$t(o)||ce(o)?!1:At(o).position==="fixed"||os(o,e)}function cn(t,e){const o=e.get(t);if(o)return o;let i=Se(t,[],!1).filter(l=>$t(l)&&he(l)!=="body"),s=null;const r=At(t).position==="fixed";let n=r?Wt(t):t;for(;$t(n)&&!ce(n);){const l=At(n),c=Vo(n);!c&&l.position==="fixed"&&(s=null),(r?!c&&!s:!c&&l.position==="static"&&!!s&&(s.position==="absolute"||s.position==="fixed")||Te(n)&&!c&&os(t,n))?i=i.filter(b=>b!==n):s=l,n=Wt(n)}return e.set(t,i),i}function dn(t){let{element:e,boundary:o,rootBoundary:i,strategy:s}=t;const n=[...o==="clippingAncestors"?Ge(e)?[]:cn(e,this._c):[].concat(o),i],l=zi(e,n[0],s);let c=l.top,p=l.right,b=l.bottom,f=l.left;for(let y=1;y<n.length;y++){const v=zi(e,n[y],s);c=mt(v.top,c),p=Ht(v.right,p),b=Ht(v.bottom,b),f=mt(v.left,f)}return{width:p-f,height:b-c,x:f,y:c}}function un(t){const{width:e,height:o}=Qi(t);return{width:e,height:o}}function hn(t,e,o){const i=Bt(e),s=Pt(e),r=o==="fixed",n=te(t,!0,r,e);let l={scrollLeft:0,scrollTop:0};const c=zt(0);function p(){c.x=Ze(s)}if(i||!i&&!r)if((he(e)!=="body"||Te(s))&&(l=Je(e)),i){const v=te(e,!0,r,e);c.x=v.x+e.clientLeft,c.y=v.y+e.clientTop}else s&&p();r&&!i&&s&&p();const b=s&&!i&&!r?es(s,l):zt(0),f=n.left+l.scrollLeft-c.x-b.x,y=n.top+l.scrollTop-c.y-b.y;return{x:f,y,width:n.width,height:n.height}}function mo(t){return At(t).position==="static"}function Li(t,e){if(!Bt(t)||At(t).position==="fixed")return null;if(e)return e(t);let o=t.offsetParent;return Pt(t)===o&&(o=o.ownerDocument.body),o}function is(t,e){const o=gt(t);if(Ge(t))return o;if(!Bt(t)){let s=Wt(t);for(;s&&!ce(s);){if($t(s)&&!mo(s))return s;s=Wt(s)}return o}let i=Li(t,e);for(;i&&Jr(i)&&mo(i);)i=Li(i,e);return i&&ce(i)&&mo(i)&&!Vo(i)?o:i||tn(t)||o}const pn=async function(t){const e=this.getOffsetParent||is,o=this.getDimensions,i=await o(t.floating);return{reference:hn(t.reference,await e(t.floating),t.strategy),floating:{x:0,y:0,width:i.width,height:i.height}}};function fn(t){return At(t).direction==="rtl"}const Fe={convertOffsetParentRelativeRectToViewportRelativeRect:sn,getDocumentElement:Pt,getClippingRect:dn,getOffsetParent:is,getElementRects:pn,getClientRects:rn,getDimensions:un,getScale:ne,isElement:$t,isRTL:fn};function ss(t,e){return t.x===e.x&&t.y===e.y&&t.width===e.width&&t.height===e.height}function bn(t,e){let o=null,i;const s=Pt(t);function r(){var l;clearTimeout(i),(l=o)==null||l.disconnect(),o=null}function n(l,c){l===void 0&&(l=!1),c===void 0&&(c=1),r();const p=t.getBoundingClientRect(),{left:b,top:f,width:y,height:v}=p;if(l||e(),!y||!v)return;const w=Re(f),k=Re(s.clientWidth-(b+y)),C=Re(s.clientHeight-(f+v)),x=Re(b),z={rootMargin:-w+"px "+-k+"px "+-C+"px "+-x+"px",threshold:mt(0,Ht(1,c))||1};let O=!0;function V(A){const E=A[0].intersectionRatio;if(E!==c){if(!O)return n();E?n(!1,E):i=setTimeout(()=>{n(!1,1e-7)},1e3)}E===1&&!ss(p,t.getBoundingClientRect())&&n(),O=!1}try{o=new IntersectionObserver(V,{...z,root:s.ownerDocument})}catch{o=new IntersectionObserver(V,z)}o.observe(t)}return n(!0),r}function mn(t,e,o,i){i===void 0&&(i={});const{ancestorScroll:s=!0,ancestorResize:r=!0,elementResize:n=typeof ResizeObserver=="function",layoutShift:l=typeof IntersectionObserver=="function",animationFrame:c=!1}=i,p=Uo(t),b=s||r?[...p?Se(p):[],...e?Se(e):[]]:[];b.forEach(x=>{s&&x.addEventListener("scroll",o,{passive:!0}),r&&x.addEventListener("resize",o)});const f=p&&l?bn(p,o):null;let y=-1,v=null;n&&(v=new ResizeObserver(x=>{let[$]=x;$&&$.target===p&&v&&e&&(v.unobserve(e),cancelAnimationFrame(y),y=requestAnimationFrame(()=>{var z;(z=v)==null||z.observe(e)})),o()}),p&&!c&&v.observe(p),e&&v.observe(e));let w,k=c?te(t):null;c&&C();function C(){const x=te(t);k&&!ss(k,x)&&o(),k=x,w=requestAnimationFrame(C)}return o(),()=>{var x;b.forEach($=>{s&&$.removeEventListener("scroll",o),r&&$.removeEventListener("resize",o)}),f==null||f(),(x=v)==null||x.disconnect(),v=null,c&&cancelAnimationFrame(w)}}const gn=Yr,vn=Xr,yn=jr,Oi=Gr,_n=Wr,wn=(t,e,o)=>{const i=new Map,s={platform:Fe,...o},r={...s.platform,_c:i};return Ur(t,e,{...s,platform:r})};function xn(t){return kn(t)}function go(t){return t.assignedSlot?t.assignedSlot:t.parentNode instanceof ShadowRoot?t.parentNode.host:t.parentNode}function kn(t){for(let e=t;e;e=go(e))if(e instanceof Element&&getComputedStyle(e).display==="none")return null;for(let e=go(t);e;e=go(e)){if(!(e instanceof Element))continue;const o=getComputedStyle(e);if(o.display!=="contents"&&(o.position!=="static"||o.filter!=="none"||e.tagName==="BODY"))return e}return null}function Cn(t){return t!==null&&typeof t=="object"&&"getBoundingClientRect"in t&&("contextElement"in t?t instanceof Element:!0)}var I=class extends q{constructor(){super(...arguments),this.active=!1,this.placement="top",this.strategy="absolute",this.distance=0,this.skidding=0,this.arrow=!1,this.arrowPlacement="anchor",this.arrowPadding=10,this.flip=!1,this.flipFallbackPlacements="",this.flipFallbackStrategy="best-fit",this.flipPadding=0,this.shift=!1,this.shiftPadding=0,this.autoSizePadding=0,this.hoverBridge=!1,this.updateHoverBridge=()=>{if(this.hoverBridge&&this.anchorEl){const t=this.anchorEl.getBoundingClientRect(),e=this.popup.getBoundingClientRect(),o=this.placement.includes("top")||this.placement.includes("bottom");let i=0,s=0,r=0,n=0,l=0,c=0,p=0,b=0;o?t.top<e.top?(i=t.left,s=t.bottom,r=t.right,n=t.bottom,l=e.left,c=e.top,p=e.right,b=e.top):(i=e.left,s=e.bottom,r=e.right,n=e.bottom,l=t.left,c=t.top,p=t.right,b=t.top):t.left<e.left?(i=t.right,s=t.top,r=e.left,n=e.top,l=t.right,c=t.bottom,p=e.left,b=e.bottom):(i=e.right,s=e.top,r=t.left,n=t.top,l=e.right,c=e.bottom,p=t.left,b=t.bottom),this.style.setProperty("--hover-bridge-top-left-x",`${i}px`),this.style.setProperty("--hover-bridge-top-left-y",`${s}px`),this.style.setProperty("--hover-bridge-top-right-x",`${r}px`),this.style.setProperty("--hover-bridge-top-right-y",`${n}px`),this.style.setProperty("--hover-bridge-bottom-left-x",`${l}px`),this.style.setProperty("--hover-bridge-bottom-left-y",`${c}px`),this.style.setProperty("--hover-bridge-bottom-right-x",`${p}px`),this.style.setProperty("--hover-bridge-bottom-right-y",`${b}px`)}}}async connectedCallback(){super.connectedCallback(),await this.updateComplete,this.start()}disconnectedCallback(){super.disconnectedCallback(),this.stop()}async updated(t){super.updated(t),t.has("active")&&(this.active?this.start():this.stop()),t.has("anchor")&&this.handleAnchorChange(),this.active&&(await this.updateComplete,this.reposition())}async handleAnchorChange(){if(await this.stop(),this.anchor&&typeof this.anchor=="string"){const t=this.getRootNode();this.anchorEl=t.getElementById(this.anchor)}else this.anchor instanceof Element||Cn(this.anchor)?this.anchorEl=this.anchor:this.anchorEl=this.querySelector('[slot="anchor"]');this.anchorEl instanceof HTMLSlotElement&&(this.anchorEl=this.anchorEl.assignedElements({flatten:!0})[0]),this.anchorEl&&this.start()}start(){this.anchorEl&&(this.cleanup=mn(this.anchorEl,this.popup,()=>{this.reposition()}))}async stop(){return new Promise(t=>{this.cleanup?(this.cleanup(),this.cleanup=void 0,this.removeAttribute("data-current-placement"),this.style.removeProperty("--auto-size-available-width"),this.style.removeProperty("--auto-size-available-height"),requestAnimationFrame(()=>t())):t()})}reposition(){if(!this.active||!this.anchorEl)return;const t=[gn({mainAxis:this.distance,crossAxis:this.skidding})];this.sync?t.push(Oi({apply:({rects:o})=>{const i=this.sync==="width"||this.sync==="both",s=this.sync==="height"||this.sync==="both";this.popup.style.width=i?`${o.reference.width}px`:"",this.popup.style.height=s?`${o.reference.height}px`:""}})):(this.popup.style.width="",this.popup.style.height=""),this.flip&&t.push(yn({boundary:this.flipBoundary,fallbackPlacements:this.flipFallbackPlacements,fallbackStrategy:this.flipFallbackStrategy==="best-fit"?"bestFit":"initialPlacement",padding:this.flipPadding})),this.shift&&t.push(vn({boundary:this.shiftBoundary,padding:this.shiftPadding})),this.autoSize?t.push(Oi({boundary:this.autoSizeBoundary,padding:this.autoSizePadding,apply:({availableWidth:o,availableHeight:i})=>{this.autoSize==="vertical"||this.autoSize==="both"?this.style.setProperty("--auto-size-available-height",`${i}px`):this.style.removeProperty("--auto-size-available-height"),this.autoSize==="horizontal"||this.autoSize==="both"?this.style.setProperty("--auto-size-available-width",`${o}px`):this.style.removeProperty("--auto-size-available-width")}})):(this.style.removeProperty("--auto-size-available-width"),this.style.removeProperty("--auto-size-available-height")),this.arrow&&t.push(_n({element:this.arrowEl,padding:this.arrowPadding}));const e=this.strategy==="absolute"?o=>Fe.getOffsetParent(o,xn):Fe.getOffsetParent;wn(this.anchorEl,this.popup,{placement:this.placement,middleware:t,strategy:this.strategy,platform:Ke(jt({},Fe),{getOffsetParent:e})}).then(({x:o,y:i,middlewareData:s,placement:r})=>{const n=getComputedStyle(this).direction==="rtl",l={top:"bottom",right:"left",bottom:"top",left:"right"}[r.split("-")[0]];if(this.setAttribute("data-current-placement",r),Object.assign(this.popup.style,{left:`${o}px`,top:`${i}px`}),this.arrow){const c=s.arrow.x,p=s.arrow.y;let b="",f="",y="",v="";if(this.arrowPlacement==="start"){const w=typeof c=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"";b=typeof p=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"",f=n?w:"",v=n?"":w}else if(this.arrowPlacement==="end"){const w=typeof c=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:"";f=n?"":w,v=n?w:"",y=typeof p=="number"?`calc(${this.arrowPadding}px - var(--arrow-padding-offset))`:""}else this.arrowPlacement==="center"?(v=typeof c=="number"?"calc(50% - var(--arrow-size-diagonal))":"",b=typeof p=="number"?"calc(50% - var(--arrow-size-diagonal))":""):(v=typeof c=="number"?`${c}px`:"",b=typeof p=="number"?`${p}px`:"");Object.assign(this.arrowEl.style,{top:b,right:f,bottom:y,left:v,[l]:"calc(var(--arrow-size-diagonal) * -1)"})}}),requestAnimationFrame(()=>this.updateHoverBridge()),this.emit("sl-reposition")}render(){return T`
      <slot name="anchor" @slotchange=${this.handleAnchorChange}></slot>

      <span
        part="hover-bridge"
        class=${X({"popup-hover-bridge":!0,"popup-hover-bridge--visible":this.hoverBridge&&this.active})}
      ></span>

      <div
        part="popup"
        class=${X({popup:!0,"popup--active":this.active,"popup--fixed":this.strategy==="fixed","popup--has-arrow":this.arrow})}
      >
        <slot></slot>
        ${this.arrow?T`<div part="arrow" class="popup__arrow" role="presentation"></div>`:""}
      </div>
    `}};I.styles=[tt,Or];a([H(".popup")],I.prototype,"popup",2);a([H(".popup__arrow")],I.prototype,"arrowEl",2);a([u()],I.prototype,"anchor",2);a([u({type:Boolean,reflect:!0})],I.prototype,"active",2);a([u({reflect:!0})],I.prototype,"placement",2);a([u({reflect:!0})],I.prototype,"strategy",2);a([u({type:Number})],I.prototype,"distance",2);a([u({type:Number})],I.prototype,"skidding",2);a([u({type:Boolean})],I.prototype,"arrow",2);a([u({attribute:"arrow-placement"})],I.prototype,"arrowPlacement",2);a([u({attribute:"arrow-padding",type:Number})],I.prototype,"arrowPadding",2);a([u({type:Boolean})],I.prototype,"flip",2);a([u({attribute:"flip-fallback-placements",converter:{fromAttribute:t=>t.split(" ").map(e=>e.trim()).filter(e=>e!==""),toAttribute:t=>t.join(" ")}})],I.prototype,"flipFallbackPlacements",2);a([u({attribute:"flip-fallback-strategy"})],I.prototype,"flipFallbackStrategy",2);a([u({type:Object})],I.prototype,"flipBoundary",2);a([u({attribute:"flip-padding",type:Number})],I.prototype,"flipPadding",2);a([u({type:Boolean})],I.prototype,"shift",2);a([u({type:Object})],I.prototype,"shiftBoundary",2);a([u({attribute:"shift-padding",type:Number})],I.prototype,"shiftPadding",2);a([u({attribute:"auto-size"})],I.prototype,"autoSize",2);a([u()],I.prototype,"sync",2);a([u({type:Object})],I.prototype,"autoSizeBoundary",2);a([u({attribute:"auto-size-padding",type:Number})],I.prototype,"autoSizePadding",2);a([u({attribute:"hover-bridge",type:Boolean})],I.prototype,"hoverBridge",2);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class Ao extends Oo{constructor(e){if(super(e),this.it=j,e.type!==Ft.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(e){if(e===j||e==null)return this._t=void 0,this.it=e;if(e===_t)return e;if(typeof e!="string")throw Error(this.constructor.directiveName+"() called with a non-string value");if(e===this.it)return this._t;this.it=e;const o=[e];return o.raw=o,this._t={_$litType$:this.constructor.resultType,strings:o,values:[]}}}Ao.directiveName="unsafeHTML",Ao.resultType=1;const $n=Lo(Ao);var P=class extends q{constructor(){super(...arguments),this.formControlController=new Ye(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new ee(this,"help-text","label"),this.localize=new Et(this),this.typeToSelectString="",this.hasFocus=!1,this.displayLabel="",this.selectedOptions=[],this.name="",this.value="",this.defaultValue="",this.size="medium",this.placeholder="",this.multiple=!1,this.maxOptionsVisible=3,this.disabled=!1,this.clearable=!1,this.open=!1,this.hoist=!1,this.filled=!1,this.pill=!1,this.label="",this.placement="bottom",this.helpText="",this.form="",this.required=!1,this.getTag=t=>T`
      <sl-tag
        part="tag"
        exportparts="
              base:tag__base,
              content:tag__content,
              remove-button:tag__remove-button,
              remove-button__base:tag__remove-button__base
            "
        ?pill=${this.pill}
        size=${this.size}
        removable
        @sl-remove=${e=>this.handleTagRemove(e,t)}
      >
        ${t.getTextLabel()}
      </sl-tag>
    `,this.handleDocumentFocusIn=t=>{const e=t.composedPath();this&&!e.includes(this)&&this.hide()},this.handleDocumentKeyDown=t=>{const e=t.target,o=e.closest(".select__clear")!==null,i=e.closest("sl-icon-button")!==null;if(!(o||i)){if(t.key==="Escape"&&this.open&&!this.closeWatcher&&(t.preventDefault(),t.stopPropagation(),this.hide(),this.displayInput.focus({preventScroll:!0})),t.key==="Enter"||t.key===" "&&this.typeToSelectString===""){if(t.preventDefault(),t.stopImmediatePropagation(),!this.open){this.show();return}this.currentOption&&!this.currentOption.disabled&&(this.multiple?this.toggleOptionSelection(this.currentOption):this.setSelectedOptions(this.currentOption),this.updateComplete.then(()=>{this.emit("sl-input"),this.emit("sl-change")}),this.multiple||(this.hide(),this.displayInput.focus({preventScroll:!0})));return}if(["ArrowUp","ArrowDown","Home","End"].includes(t.key)){const s=this.getAllOptions(),r=s.indexOf(this.currentOption);let n=Math.max(0,r);if(t.preventDefault(),!this.open&&(this.show(),this.currentOption))return;t.key==="ArrowDown"?(n=r+1,n>s.length-1&&(n=0)):t.key==="ArrowUp"?(n=r-1,n<0&&(n=s.length-1)):t.key==="Home"?n=0:t.key==="End"&&(n=s.length-1),this.setCurrentOption(s[n])}if(t.key.length===1||t.key==="Backspace"){const s=this.getAllOptions();if(t.metaKey||t.ctrlKey||t.altKey)return;if(!this.open){if(t.key==="Backspace")return;this.show()}t.stopPropagation(),t.preventDefault(),clearTimeout(this.typeToSelectTimeout),this.typeToSelectTimeout=window.setTimeout(()=>this.typeToSelectString="",1e3),t.key==="Backspace"?this.typeToSelectString=this.typeToSelectString.slice(0,-1):this.typeToSelectString+=t.key.toLowerCase();for(const r of s)if(r.getTextLabel().toLowerCase().startsWith(this.typeToSelectString)){this.setCurrentOption(r);break}}}},this.handleDocumentMouseDown=t=>{const e=t.composedPath();this&&!e.includes(this)&&this.hide()}}get validity(){return this.valueInput.validity}get validationMessage(){return this.valueInput.validationMessage}connectedCallback(){super.connectedCallback(),this.open=!1}addOpenListeners(){var t;document.addEventListener("focusin",this.handleDocumentFocusIn),document.addEventListener("keydown",this.handleDocumentKeyDown),document.addEventListener("mousedown",this.handleDocumentMouseDown),this.getRootNode()!==document&&this.getRootNode().addEventListener("focusin",this.handleDocumentFocusIn),"CloseWatcher"in window&&((t=this.closeWatcher)==null||t.destroy(),this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>{this.open&&(this.hide(),this.displayInput.focus({preventScroll:!0}))})}removeOpenListeners(){var t;document.removeEventListener("focusin",this.handleDocumentFocusIn),document.removeEventListener("keydown",this.handleDocumentKeyDown),document.removeEventListener("mousedown",this.handleDocumentMouseDown),this.getRootNode()!==document&&this.getRootNode().removeEventListener("focusin",this.handleDocumentFocusIn),(t=this.closeWatcher)==null||t.destroy()}handleFocus(){this.hasFocus=!0,this.displayInput.setSelectionRange(0,0),this.emit("sl-focus")}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleLabelClick(){this.displayInput.focus()}handleComboboxMouseDown(t){const o=t.composedPath().some(i=>i instanceof Element&&i.tagName.toLowerCase()==="sl-icon-button");this.disabled||o||(t.preventDefault(),this.displayInput.focus({preventScroll:!0}),this.open=!this.open)}handleComboboxKeyDown(t){t.key!=="Tab"&&(t.stopPropagation(),this.handleDocumentKeyDown(t))}handleClearClick(t){t.stopPropagation(),this.value!==""&&(this.setSelectedOptions([]),this.displayInput.focus({preventScroll:!0}),this.updateComplete.then(()=>{this.emit("sl-clear"),this.emit("sl-input"),this.emit("sl-change")}))}handleClearMouseDown(t){t.stopPropagation(),t.preventDefault()}handleOptionClick(t){const o=t.target.closest("sl-option"),i=this.value;o&&!o.disabled&&(this.multiple?this.toggleOptionSelection(o):this.setSelectedOptions(o),this.updateComplete.then(()=>this.displayInput.focus({preventScroll:!0})),this.value!==i&&this.updateComplete.then(()=>{this.emit("sl-input"),this.emit("sl-change")}),this.multiple||(this.hide(),this.displayInput.focus({preventScroll:!0})))}handleDefaultSlotChange(){const t=this.getAllOptions(),e=Array.isArray(this.value)?this.value:[this.value],o=[];customElements.get("sl-option")?(t.forEach(i=>o.push(i.value)),this.setSelectedOptions(t.filter(i=>e.includes(i.value)))):customElements.whenDefined("sl-option").then(()=>this.handleDefaultSlotChange())}handleTagRemove(t,e){t.stopPropagation(),this.disabled||(this.toggleOptionSelection(e,!1),this.updateComplete.then(()=>{this.emit("sl-input"),this.emit("sl-change")}))}getAllOptions(){return[...this.querySelectorAll("sl-option")]}getFirstOption(){return this.querySelector("sl-option")}setCurrentOption(t){this.getAllOptions().forEach(o=>{o.current=!1,o.tabIndex=-1}),t&&(this.currentOption=t,t.current=!0,t.tabIndex=0,t.focus())}setSelectedOptions(t){const e=this.getAllOptions(),o=Array.isArray(t)?t:[t];e.forEach(i=>i.selected=!1),o.length&&o.forEach(i=>i.selected=!0),this.selectionChanged()}toggleOptionSelection(t,e){e===!0||e===!1?t.selected=e:t.selected=!t.selected,this.selectionChanged()}selectionChanged(){var t,e,o,i;this.selectedOptions=this.getAllOptions().filter(s=>s.selected),this.multiple?(this.value=this.selectedOptions.map(s=>s.value),this.placeholder&&this.value.length===0?this.displayLabel="":this.displayLabel=this.localize.term("numOptionsSelected",this.selectedOptions.length)):(this.value=(e=(t=this.selectedOptions[0])==null?void 0:t.value)!=null?e:"",this.displayLabel=(i=(o=this.selectedOptions[0])==null?void 0:o.getTextLabel())!=null?i:""),this.updateComplete.then(()=>{this.formControlController.updateValidity()})}get tags(){return this.selectedOptions.map((t,e)=>{if(e<this.maxOptionsVisible||this.maxOptionsVisible<=0){const o=this.getTag(t,e);return T`<div @sl-remove=${i=>this.handleTagRemove(i,t)}>
          ${typeof o=="string"?$n(o):o}
        </div>`}else if(e===this.maxOptionsVisible)return T`<sl-tag size=${this.size}>+${this.selectedOptions.length-e}</sl-tag>`;return T``})}handleInvalid(t){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(t)}handleDisabledChange(){this.disabled&&(this.open=!1,this.handleOpenChange())}handleValueChange(){const t=this.getAllOptions(),e=Array.isArray(this.value)?this.value:[this.value];this.setSelectedOptions(t.filter(o=>e.includes(o.value)))}async handleOpenChange(){if(this.open&&!this.disabled){this.setCurrentOption(this.selectedOptions[0]||this.getFirstOption()),this.emit("sl-show"),this.addOpenListeners(),await Tt(this),this.listbox.hidden=!1,this.popup.active=!0,requestAnimationFrame(()=>{this.setCurrentOption(this.currentOption)});const{keyframes:t,options:e}=kt(this,"select.show",{dir:this.localize.dir()});await Ct(this.popup.popup,t,e),this.currentOption&&xo(this.currentOption,this.listbox,"vertical","auto"),this.emit("sl-after-show")}else{this.emit("sl-hide"),this.removeOpenListeners(),await Tt(this);const{keyframes:t,options:e}=kt(this,"select.hide",{dir:this.localize.dir()});await Ct(this.popup.popup,t,e),this.listbox.hidden=!0,this.popup.active=!1,this.emit("sl-after-hide")}}async show(){if(this.open||this.disabled){this.open=!1;return}return this.open=!0,Vt(this,"sl-after-show")}async hide(){if(!this.open||this.disabled){this.open=!1;return}return this.open=!1,Vt(this,"sl-after-hide")}checkValidity(){return this.valueInput.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.valueInput.reportValidity()}setCustomValidity(t){this.valueInput.setCustomValidity(t),this.formControlController.updateValidity()}focus(t){this.displayInput.focus(t)}blur(){this.displayInput.blur()}render(){const t=this.hasSlotController.test("label"),e=this.hasSlotController.test("help-text"),o=this.label?!0:!!t,i=this.helpText?!0:!!e,s=this.clearable&&!this.disabled&&this.value.length>0,r=this.placeholder&&this.value.length===0;return T`
      <div
        part="form-control"
        class=${X({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":o,"form-control--has-help-text":i})}
      >
        <label
          id="label"
          part="form-control-label"
          class="form-control__label"
          aria-hidden=${o?"false":"true"}
          @click=${this.handleLabelClick}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <sl-popup
            class=${X({select:!0,"select--standard":!0,"select--filled":this.filled,"select--pill":this.pill,"select--open":this.open,"select--disabled":this.disabled,"select--multiple":this.multiple,"select--focused":this.hasFocus,"select--placeholder-visible":r,"select--top":this.placement==="top","select--bottom":this.placement==="bottom","select--small":this.size==="small","select--medium":this.size==="medium","select--large":this.size==="large"})}
            placement=${this.placement}
            strategy=${this.hoist?"fixed":"absolute"}
            flip
            shift
            sync="width"
            auto-size="vertical"
            auto-size-padding="10"
          >
            <div
              part="combobox"
              class="select__combobox"
              slot="anchor"
              @keydown=${this.handleComboboxKeyDown}
              @mousedown=${this.handleComboboxMouseDown}
            >
              <slot part="prefix" name="prefix" class="select__prefix"></slot>

              <input
                part="display-input"
                class="select__display-input"
                type="text"
                placeholder=${this.placeholder}
                .disabled=${this.disabled}
                .value=${this.displayLabel}
                autocomplete="off"
                spellcheck="false"
                autocapitalize="off"
                readonly
                aria-controls="listbox"
                aria-expanded=${this.open?"true":"false"}
                aria-haspopup="listbox"
                aria-labelledby="label"
                aria-disabled=${this.disabled?"true":"false"}
                aria-describedby="help-text"
                role="combobox"
                tabindex="0"
                @focus=${this.handleFocus}
                @blur=${this.handleBlur}
              />

              ${this.multiple?T`<div part="tags" class="select__tags">${this.tags}</div>`:""}

              <input
                class="select__value-input"
                type="text"
                ?disabled=${this.disabled}
                ?required=${this.required}
                .value=${Array.isArray(this.value)?this.value.join(", "):this.value}
                tabindex="-1"
                aria-hidden="true"
                @focus=${()=>this.focus()}
                @invalid=${this.handleInvalid}
              />

              ${s?T`
                    <button
                      part="clear-button"
                      class="select__clear"
                      type="button"
                      aria-label=${this.localize.term("clearEntry")}
                      @mousedown=${this.handleClearMouseDown}
                      @click=${this.handleClearClick}
                      tabindex="-1"
                    >
                      <slot name="clear-icon">
                        <sl-icon name="x-circle-fill" library="system"></sl-icon>
                      </slot>
                    </button>
                  `:""}

              <slot name="expand-icon" part="expand-icon" class="select__expand-icon">
                <sl-icon library="system" name="chevron-down"></sl-icon>
              </slot>
            </div>

            <div
              id="listbox"
              role="listbox"
              aria-expanded=${this.open?"true":"false"}
              aria-multiselectable=${this.multiple?"true":"false"}
              aria-labelledby="label"
              part="listbox"
              class="select__listbox"
              tabindex="-1"
              @mouseup=${this.handleOptionClick}
              @slotchange=${this.handleDefaultSlotChange}
            >
              <slot></slot>
            </div>
          </sl-popup>
        </div>

        <div
          part="form-control-help-text"
          id="help-text"
          class="form-control__help-text"
          aria-hidden=${i?"false":"true"}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `}};P.styles=[tt,Io,Lr];P.dependencies={"sl-icon":lt,"sl-popup":I,"sl-tag":qt};a([H(".select")],P.prototype,"popup",2);a([H(".select__combobox")],P.prototype,"combobox",2);a([H(".select__display-input")],P.prototype,"displayInput",2);a([H(".select__value-input")],P.prototype,"valueInput",2);a([H(".select__listbox")],P.prototype,"listbox",2);a([dt()],P.prototype,"hasFocus",2);a([dt()],P.prototype,"displayLabel",2);a([dt()],P.prototype,"currentOption",2);a([dt()],P.prototype,"selectedOptions",2);a([u()],P.prototype,"name",2);a([u({converter:{fromAttribute:t=>t.split(" "),toAttribute:t=>t.join(" ")}})],P.prototype,"value",2);a([Bo()],P.prototype,"defaultValue",2);a([u({reflect:!0})],P.prototype,"size",2);a([u()],P.prototype,"placeholder",2);a([u({type:Boolean,reflect:!0})],P.prototype,"multiple",2);a([u({attribute:"max-options-visible",type:Number})],P.prototype,"maxOptionsVisible",2);a([u({type:Boolean,reflect:!0})],P.prototype,"disabled",2);a([u({type:Boolean})],P.prototype,"clearable",2);a([u({type:Boolean,reflect:!0})],P.prototype,"open",2);a([u({type:Boolean})],P.prototype,"hoist",2);a([u({type:Boolean,reflect:!0})],P.prototype,"filled",2);a([u({type:Boolean,reflect:!0})],P.prototype,"pill",2);a([u()],P.prototype,"label",2);a([u({reflect:!0})],P.prototype,"placement",2);a([u({attribute:"help-text"})],P.prototype,"helpText",2);a([u({reflect:!0})],P.prototype,"form",2);a([u({type:Boolean,reflect:!0})],P.prototype,"required",2);a([u()],P.prototype,"getTag",2);a([N("disabled",{waitUntilFirstUpdate:!0})],P.prototype,"handleDisabledChange",1);a([N("value",{waitUntilFirstUpdate:!0})],P.prototype,"handleValueChange",1);a([N("open",{waitUntilFirstUpdate:!0})],P.prototype,"handleOpenChange",1);St("select.show",{keyframes:[{opacity:0,scale:.9},{opacity:1,scale:1}],options:{duration:100,easing:"ease"}});St("select.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.9}],options:{duration:100,easing:"ease"}});P.define("sl-select");var An=G`
  :host {
    --border-radius: var(--sl-border-radius-pill);
    --color: var(--sl-color-neutral-200);
    --sheen-color: var(--sl-color-neutral-300);

    display: block;
    position: relative;
  }

  .skeleton {
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 1rem;
  }

  .skeleton__indicator {
    flex: 1 1 auto;
    background: var(--color);
    border-radius: var(--border-radius);
  }

  .skeleton--sheen .skeleton__indicator {
    background: linear-gradient(270deg, var(--sheen-color), var(--color), var(--color), var(--sheen-color));
    background-size: 400% 100%;
    animation: sheen 8s ease-in-out infinite;
  }

  .skeleton--pulse .skeleton__indicator {
    animation: pulse 2s ease-in-out 0.5s infinite;
  }

  /* Forced colors mode */
  @media (forced-colors: active) {
    :host {
      --color: GrayText;
    }
  }

  @keyframes sheen {
    0% {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
    100% {
      opacity: 1;
    }
  }
`,Wo=class extends q{constructor(){super(...arguments),this.effect="none"}render(){return T`
      <div
        part="base"
        class=${X({skeleton:!0,"skeleton--pulse":this.effect==="pulse","skeleton--sheen":this.effect==="sheen"})}
      >
        <div part="indicator" class="skeleton__indicator"></div>
      </div>
    `}};Wo.styles=[tt,An];a([u()],Wo.prototype,"effect",2);Wo.define("sl-skeleton");var Sn=G`
  :host {
    display: inline-block;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-small);
    font-weight: var(--sl-font-weight-semibold);
    border-radius: var(--sl-border-radius-medium);
    color: var(--sl-color-neutral-600);
    padding: var(--sl-spacing-medium) var(--sl-spacing-large);
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
    transition:
      var(--transition-speed) box-shadow,
      var(--transition-speed) color;
  }

  .tab:hover:not(.tab--disabled) {
    color: var(--sl-color-primary-600);
  }

  .tab:focus {
    outline: none;
  }

  .tab:focus-visible:not(.tab--disabled) {
    color: var(--sl-color-primary-600);
  }

  .tab:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: calc(-1 * var(--sl-focus-ring-width) - var(--sl-focus-ring-offset));
  }

  .tab.tab--active:not(.tab--disabled) {
    color: var(--sl-color-primary-600);
  }

  .tab.tab--closable {
    padding-inline-end: var(--sl-spacing-small);
  }

  .tab.tab--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tab__close-button {
    font-size: var(--sl-font-size-small);
    margin-inline-start: var(--sl-spacing-small);
  }

  .tab__close-button::part(base) {
    padding: var(--sl-spacing-3x-small);
  }

  @media (forced-colors: active) {
    .tab.tab--active:not(.tab--disabled) {
      outline: solid 1px transparent;
      outline-offset: -3px;
    }
  }
`,En=0,Dt=class extends q{constructor(){super(...arguments),this.localize=new Et(this),this.attrId=++En,this.componentId=`sl-tab-${this.attrId}`,this.panel="",this.active=!1,this.closable=!1,this.disabled=!1}connectedCallback(){super.connectedCallback(),this.setAttribute("role","tab")}handleCloseClick(t){t.stopPropagation(),this.emit("sl-close")}handleActiveChange(){this.setAttribute("aria-selected",this.active?"true":"false")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false")}focus(t){this.tab.focus(t)}blur(){this.tab.blur()}render(){return this.id=this.id.length>0?this.id:this.componentId,T`
      <div
        part="base"
        class=${X({tab:!0,"tab--active":this.active,"tab--closable":this.closable,"tab--disabled":this.disabled})}
        tabindex=${this.disabled?"-1":"0"}
      >
        <slot></slot>
        ${this.closable?T`
              <sl-icon-button
                part="close-button"
                exportparts="base:close-button__base"
                name="x-lg"
                library="system"
                label=${this.localize.term("close")}
                class="tab__close-button"
                @click=${this.handleCloseClick}
                tabindex="-1"
              ></sl-icon-button>
            `:""}
      </div>
    `}};Dt.styles=[tt,Sn];Dt.dependencies={"sl-icon-button":ot};a([H(".tab")],Dt.prototype,"tab",2);a([u({reflect:!0})],Dt.prototype,"panel",2);a([u({type:Boolean,reflect:!0})],Dt.prototype,"active",2);a([u({type:Boolean})],Dt.prototype,"closable",2);a([u({type:Boolean,reflect:!0})],Dt.prototype,"disabled",2);a([N("active")],Dt.prototype,"handleActiveChange",1);a([N("disabled")],Dt.prototype,"handleDisabledChange",1);Dt.define("sl-tab");var Tn=G`
  :host {
    --indicator-color: var(--sl-color-primary-600);
    --track-color: var(--sl-color-neutral-200);
    --track-width: 2px;

    display: block;
  }

  .tab-group {
    display: flex;
    border-radius: 0;
  }

  .tab-group__tabs {
    display: flex;
    position: relative;
  }

  .tab-group__indicator {
    position: absolute;
    transition:
      var(--sl-transition-fast) translate ease,
      var(--sl-transition-fast) width ease;
  }

  .tab-group--has-scroll-controls .tab-group__nav-container {
    position: relative;
    padding: 0 var(--sl-spacing-x-large);
  }

  .tab-group__body {
    display: block;
    overflow: auto;
  }

  .tab-group__scroll-button {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--sl-spacing-x-large);
  }

  .tab-group__scroll-button--start {
    left: 0;
  }

  .tab-group__scroll-button--end {
    right: 0;
  }

  .tab-group--rtl .tab-group__scroll-button--start {
    left: auto;
    right: 0;
  }

  .tab-group--rtl .tab-group__scroll-button--end {
    left: 0;
    right: auto;
  }

  /*
   * Top
   */

  .tab-group--top {
    flex-direction: column;
  }

  .tab-group--top .tab-group__nav-container {
    order: 1;
  }

  .tab-group--top .tab-group__nav {
    display: flex;
    overflow-x: auto;

    /* Hide scrollbar in Firefox */
    scrollbar-width: none;
  }

  /* Hide scrollbar in Chrome/Safari */
  .tab-group--top .tab-group__nav::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .tab-group--top .tab-group__tabs {
    flex: 1 1 auto;
    position: relative;
    flex-direction: row;
    border-bottom: solid var(--track-width) var(--track-color);
  }

  .tab-group--top .tab-group__indicator {
    bottom: calc(-1 * var(--track-width));
    border-bottom: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--top .tab-group__body {
    order: 2;
  }

  .tab-group--top ::slotted(sl-tab-panel) {
    --padding: var(--sl-spacing-medium) 0;
  }

  /*
   * Bottom
   */

  .tab-group--bottom {
    flex-direction: column;
  }

  .tab-group--bottom .tab-group__nav-container {
    order: 2;
  }

  .tab-group--bottom .tab-group__nav {
    display: flex;
    overflow-x: auto;

    /* Hide scrollbar in Firefox */
    scrollbar-width: none;
  }

  /* Hide scrollbar in Chrome/Safari */
  .tab-group--bottom .tab-group__nav::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .tab-group--bottom .tab-group__tabs {
    flex: 1 1 auto;
    position: relative;
    flex-direction: row;
    border-top: solid var(--track-width) var(--track-color);
  }

  .tab-group--bottom .tab-group__indicator {
    top: calc(-1 * var(--track-width));
    border-top: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--bottom .tab-group__body {
    order: 1;
  }

  .tab-group--bottom ::slotted(sl-tab-panel) {
    --padding: var(--sl-spacing-medium) 0;
  }

  /*
   * Start
   */

  .tab-group--start {
    flex-direction: row;
  }

  .tab-group--start .tab-group__nav-container {
    order: 1;
  }

  .tab-group--start .tab-group__tabs {
    flex: 0 0 auto;
    flex-direction: column;
    border-inline-end: solid var(--track-width) var(--track-color);
  }

  .tab-group--start .tab-group__indicator {
    right: calc(-1 * var(--track-width));
    border-right: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--start.tab-group--rtl .tab-group__indicator {
    right: auto;
    left: calc(-1 * var(--track-width));
  }

  .tab-group--start .tab-group__body {
    flex: 1 1 auto;
    order: 2;
  }

  .tab-group--start ::slotted(sl-tab-panel) {
    --padding: 0 var(--sl-spacing-medium);
  }

  /*
   * End
   */

  .tab-group--end {
    flex-direction: row;
  }

  .tab-group--end .tab-group__nav-container {
    order: 2;
  }

  .tab-group--end .tab-group__tabs {
    flex: 0 0 auto;
    flex-direction: column;
    border-left: solid var(--track-width) var(--track-color);
  }

  .tab-group--end .tab-group__indicator {
    left: calc(-1 * var(--track-width));
    border-inline-start: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--end.tab-group--rtl .tab-group__indicator {
    right: calc(-1 * var(--track-width));
    left: auto;
  }

  .tab-group--end .tab-group__body {
    flex: 1 1 auto;
    order: 1;
  }

  .tab-group--end ::slotted(sl-tab-panel) {
    --padding: 0 var(--sl-spacing-medium);
  }
`,vt=class extends q{constructor(){super(...arguments),this.localize=new Et(this),this.tabs=[],this.panels=[],this.hasScrollControls=!1,this.placement="top",this.activation="auto",this.noScrollControls=!1}connectedCallback(){const t=Promise.all([customElements.whenDefined("sl-tab"),customElements.whenDefined("sl-tab-panel")]);super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.repositionIndicator(),this.updateScrollControls()}),this.mutationObserver=new MutationObserver(e=>{e.some(o=>!["aria-labelledby","aria-controls"].includes(o.attributeName))&&setTimeout(()=>this.setAriaLabels()),e.some(o=>o.attributeName==="disabled")&&this.syncTabsAndPanels()}),this.updateComplete.then(()=>{this.syncTabsAndPanels(),this.mutationObserver.observe(this,{attributes:!0,childList:!0,subtree:!0}),this.resizeObserver.observe(this.nav),t.then(()=>{new IntersectionObserver((o,i)=>{var s;o[0].intersectionRatio>0&&(this.setAriaLabels(),this.setActiveTab((s=this.getActiveTab())!=null?s:this.tabs[0],{emitEvents:!1}),i.unobserve(o[0].target))}).observe(this.tabGroup)})})}disconnectedCallback(){super.disconnectedCallback(),this.mutationObserver.disconnect(),this.resizeObserver.unobserve(this.nav)}getAllTabs(t={includeDisabled:!0}){return[...this.shadowRoot.querySelector('slot[name="nav"]').assignedElements()].filter(o=>t.includeDisabled?o.tagName.toLowerCase()==="sl-tab":o.tagName.toLowerCase()==="sl-tab"&&!o.disabled)}getAllPanels(){return[...this.body.assignedElements()].filter(t=>t.tagName.toLowerCase()==="sl-tab-panel")}getActiveTab(){return this.tabs.find(t=>t.active)}handleClick(t){const o=t.target.closest("sl-tab");(o==null?void 0:o.closest("sl-tab-group"))===this&&o!==null&&this.setActiveTab(o,{scrollBehavior:"smooth"})}handleKeyDown(t){const o=t.target.closest("sl-tab");if((o==null?void 0:o.closest("sl-tab-group"))===this&&(["Enter"," "].includes(t.key)&&o!==null&&(this.setActiveTab(o,{scrollBehavior:"smooth"}),t.preventDefault()),["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(t.key))){const s=this.tabs.find(n=>n.matches(":focus")),r=this.localize.dir()==="rtl";if((s==null?void 0:s.tagName.toLowerCase())==="sl-tab"){let n=this.tabs.indexOf(s);t.key==="Home"?n=0:t.key==="End"?n=this.tabs.length-1:["top","bottom"].includes(this.placement)&&t.key===(r?"ArrowRight":"ArrowLeft")||["start","end"].includes(this.placement)&&t.key==="ArrowUp"?n--:(["top","bottom"].includes(this.placement)&&t.key===(r?"ArrowLeft":"ArrowRight")||["start","end"].includes(this.placement)&&t.key==="ArrowDown")&&n++,n<0&&(n=this.tabs.length-1),n>this.tabs.length-1&&(n=0),this.tabs[n].focus({preventScroll:!0}),this.activation==="auto"&&this.setActiveTab(this.tabs[n],{scrollBehavior:"smooth"}),["top","bottom"].includes(this.placement)&&xo(this.tabs[n],this.nav,"horizontal"),t.preventDefault()}}}handleScrollToStart(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft+this.nav.clientWidth:this.nav.scrollLeft-this.nav.clientWidth,behavior:"smooth"})}handleScrollToEnd(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft-this.nav.clientWidth:this.nav.scrollLeft+this.nav.clientWidth,behavior:"smooth"})}setActiveTab(t,e){if(e=jt({emitEvents:!0,scrollBehavior:"auto"},e),t!==this.activeTab&&!t.disabled){const o=this.activeTab;this.activeTab=t,this.tabs.forEach(i=>i.active=i===this.activeTab),this.panels.forEach(i=>{var s;return i.active=i.name===((s=this.activeTab)==null?void 0:s.panel)}),this.syncIndicator(),["top","bottom"].includes(this.placement)&&xo(this.activeTab,this.nav,"horizontal",e.scrollBehavior),e.emitEvents&&(o&&this.emit("sl-tab-hide",{detail:{name:o.panel}}),this.emit("sl-tab-show",{detail:{name:this.activeTab.panel}}))}}setAriaLabels(){this.tabs.forEach(t=>{const e=this.panels.find(o=>o.name===t.panel);e&&(t.setAttribute("aria-controls",e.getAttribute("id")),e.setAttribute("aria-labelledby",t.getAttribute("id")))})}repositionIndicator(){const t=this.getActiveTab();if(!t)return;const e=t.clientWidth,o=t.clientHeight,i=this.localize.dir()==="rtl",s=this.getAllTabs(),n=s.slice(0,s.indexOf(t)).reduce((l,c)=>({left:l.left+c.clientWidth,top:l.top+c.clientHeight}),{left:0,top:0});switch(this.placement){case"top":case"bottom":this.indicator.style.width=`${e}px`,this.indicator.style.height="auto",this.indicator.style.translate=i?`${-1*n.left}px`:`${n.left}px`;break;case"start":case"end":this.indicator.style.width="auto",this.indicator.style.height=`${o}px`,this.indicator.style.translate=`0 ${n.top}px`;break}}syncTabsAndPanels(){this.tabs=this.getAllTabs({includeDisabled:!1}),this.panels=this.getAllPanels(),this.syncIndicator(),this.updateComplete.then(()=>this.updateScrollControls())}updateScrollControls(){this.noScrollControls?this.hasScrollControls=!1:this.hasScrollControls=["top","bottom"].includes(this.placement)&&this.nav.scrollWidth>this.nav.clientWidth+1}syncIndicator(){this.getActiveTab()?(this.indicator.style.display="block",this.repositionIndicator()):this.indicator.style.display="none"}show(t){const e=this.tabs.find(o=>o.panel===t);e&&this.setActiveTab(e,{scrollBehavior:"smooth"})}render(){const t=this.localize.dir()==="rtl";return T`
      <div
        part="base"
        class=${X({"tab-group":!0,"tab-group--top":this.placement==="top","tab-group--bottom":this.placement==="bottom","tab-group--start":this.placement==="start","tab-group--end":this.placement==="end","tab-group--rtl":this.localize.dir()==="rtl","tab-group--has-scroll-controls":this.hasScrollControls})}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="tab-group__nav-container" part="nav">
          ${this.hasScrollControls?T`
                <sl-icon-button
                  part="scroll-button scroll-button--start"
                  exportparts="base:scroll-button__base"
                  class="tab-group__scroll-button tab-group__scroll-button--start"
                  name=${t?"chevron-right":"chevron-left"}
                  library="system"
                  label=${this.localize.term("scrollToStart")}
                  @click=${this.handleScrollToStart}
                ></sl-icon-button>
              `:""}

          <div class="tab-group__nav">
            <div part="tabs" class="tab-group__tabs" role="tablist">
              <div part="active-tab-indicator" class="tab-group__indicator"></div>
              <slot name="nav" @slotchange=${this.syncTabsAndPanels}></slot>
            </div>
          </div>

          ${this.hasScrollControls?T`
                <sl-icon-button
                  part="scroll-button scroll-button--end"
                  exportparts="base:scroll-button__base"
                  class="tab-group__scroll-button tab-group__scroll-button--end"
                  name=${t?"chevron-left":"chevron-right"}
                  library="system"
                  label=${this.localize.term("scrollToEnd")}
                  @click=${this.handleScrollToEnd}
                ></sl-icon-button>
              `:""}
        </div>

        <slot part="body" class="tab-group__body" @slotchange=${this.syncTabsAndPanels}></slot>
      </div>
    `}};vt.styles=[tt,Tn];vt.dependencies={"sl-icon-button":ot};a([H(".tab-group")],vt.prototype,"tabGroup",2);a([H(".tab-group__body")],vt.prototype,"body",2);a([H(".tab-group__nav")],vt.prototype,"nav",2);a([H(".tab-group__indicator")],vt.prototype,"indicator",2);a([dt()],vt.prototype,"hasScrollControls",2);a([u()],vt.prototype,"placement",2);a([u()],vt.prototype,"activation",2);a([u({attribute:"no-scroll-controls",type:Boolean})],vt.prototype,"noScrollControls",2);a([N("noScrollControls",{waitUntilFirstUpdate:!0})],vt.prototype,"updateScrollControls",1);a([N("placement",{waitUntilFirstUpdate:!0})],vt.prototype,"syncIndicator",1);vt.define("sl-tab-group");var zn=G`
  :host {
    --padding: 0;

    display: none;
  }

  :host([active]) {
    display: block;
  }

  .tab-panel {
    display: block;
    padding: var(--padding);
  }
`,Ln=0,ze=class extends q{constructor(){super(...arguments),this.attrId=++Ln,this.componentId=`sl-tab-panel-${this.attrId}`,this.name="",this.active=!1}connectedCallback(){super.connectedCallback(),this.id=this.id.length>0?this.id:this.componentId,this.setAttribute("role","tabpanel")}handleActiveChange(){this.setAttribute("aria-hidden",this.active?"false":"true")}render(){return T`
      <slot
        part="base"
        class=${X({"tab-panel":!0,"tab-panel--active":this.active})}
      ></slot>
    `}};ze.styles=[tt,zn];a([u({reflect:!0})],ze.prototype,"name",2);a([u({type:Boolean,reflect:!0})],ze.prototype,"active",2);a([N("active")],ze.prototype,"handleActiveChange",1);ze.define("sl-tab-panel");qt.define("sl-tag");var On=G`
  :host {
    --max-width: 20rem;
    --hide-delay: 0ms;
    --show-delay: 150ms;

    display: contents;
  }

  .tooltip {
    --arrow-size: var(--sl-tooltip-arrow-size);
    --arrow-color: var(--sl-tooltip-background-color);
  }

  .tooltip::part(popup) {
    z-index: var(--sl-z-index-tooltip);
  }

  .tooltip[placement^='top']::part(popup) {
    transform-origin: bottom;
  }

  .tooltip[placement^='bottom']::part(popup) {
    transform-origin: top;
  }

  .tooltip[placement^='left']::part(popup) {
    transform-origin: right;
  }

  .tooltip[placement^='right']::part(popup) {
    transform-origin: left;
  }

  .tooltip__body {
    display: block;
    width: max-content;
    max-width: var(--max-width);
    border-radius: var(--sl-tooltip-border-radius);
    background-color: var(--sl-tooltip-background-color);
    font-family: var(--sl-tooltip-font-family);
    font-size: var(--sl-tooltip-font-size);
    font-weight: var(--sl-tooltip-font-weight);
    line-height: var(--sl-tooltip-line-height);
    color: var(--sl-tooltip-color);
    padding: var(--sl-tooltip-padding);
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }
`,it=class extends q{constructor(){super(),this.localize=new Et(this),this.content="",this.placement="top",this.disabled=!1,this.distance=8,this.open=!1,this.skidding=0,this.trigger="hover focus",this.hoist=!1,this.handleBlur=()=>{this.hasTrigger("focus")&&this.hide()},this.handleClick=()=>{this.hasTrigger("click")&&(this.open?this.hide():this.show())},this.handleFocus=()=>{this.hasTrigger("focus")&&this.show()},this.handleDocumentKeyDown=t=>{t.key==="Escape"&&(t.stopPropagation(),this.hide())},this.handleMouseOver=()=>{if(this.hasTrigger("hover")){const t=_i(getComputedStyle(this).getPropertyValue("--show-delay"));clearTimeout(this.hoverTimeout),this.hoverTimeout=window.setTimeout(()=>this.show(),t)}},this.handleMouseOut=()=>{if(this.hasTrigger("hover")){const t=_i(getComputedStyle(this).getPropertyValue("--hide-delay"));clearTimeout(this.hoverTimeout),this.hoverTimeout=window.setTimeout(()=>this.hide(),t)}},this.addEventListener("blur",this.handleBlur,!0),this.addEventListener("focus",this.handleFocus,!0),this.addEventListener("click",this.handleClick),this.addEventListener("mouseover",this.handleMouseOver),this.addEventListener("mouseout",this.handleMouseOut)}disconnectedCallback(){var t;(t=this.closeWatcher)==null||t.destroy(),document.removeEventListener("keydown",this.handleDocumentKeyDown)}firstUpdated(){this.body.hidden=!this.open,this.open&&(this.popup.active=!0,this.popup.reposition())}hasTrigger(t){return this.trigger.split(" ").includes(t)}async handleOpenChange(){var t,e;if(this.open){if(this.disabled)return;this.emit("sl-show"),"CloseWatcher"in window?((t=this.closeWatcher)==null||t.destroy(),this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>{this.hide()}):document.addEventListener("keydown",this.handleDocumentKeyDown),await Tt(this.body),this.body.hidden=!1,this.popup.active=!0;const{keyframes:o,options:i}=kt(this,"tooltip.show",{dir:this.localize.dir()});await Ct(this.popup.popup,o,i),this.popup.reposition(),this.emit("sl-after-show")}else{this.emit("sl-hide"),(e=this.closeWatcher)==null||e.destroy(),document.removeEventListener("keydown",this.handleDocumentKeyDown),await Tt(this.body);const{keyframes:o,options:i}=kt(this,"tooltip.hide",{dir:this.localize.dir()});await Ct(this.popup.popup,o,i),this.popup.active=!1,this.body.hidden=!0,this.emit("sl-after-hide")}}async handleOptionsChange(){this.hasUpdated&&(await this.updateComplete,this.popup.reposition())}handleDisabledChange(){this.disabled&&this.open&&this.hide()}async show(){if(!this.open)return this.open=!0,Vt(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Vt(this,"sl-after-hide")}render(){return T`
      <sl-popup
        part="base"
        exportparts="
          popup:base__popup,
          arrow:base__arrow
        "
        class=${X({tooltip:!0,"tooltip--open":this.open})}
        placement=${this.placement}
        distance=${this.distance}
        skidding=${this.skidding}
        strategy=${this.hoist?"fixed":"absolute"}
        flip
        shift
        arrow
        hover-bridge
      >
        ${""}
        <slot slot="anchor" aria-describedby="tooltip"></slot>

        ${""}
        <div part="body" id="tooltip" class="tooltip__body" role="tooltip" aria-live=${this.open?"polite":"off"}>
          <slot name="content">${this.content}</slot>
        </div>
      </sl-popup>
    `}};it.styles=[tt,On];it.dependencies={"sl-popup":I};a([H("slot:not([name])")],it.prototype,"defaultSlot",2);a([H(".tooltip__body")],it.prototype,"body",2);a([H("sl-popup")],it.prototype,"popup",2);a([u()],it.prototype,"content",2);a([u()],it.prototype,"placement",2);a([u({type:Boolean,reflect:!0})],it.prototype,"disabled",2);a([u({type:Number})],it.prototype,"distance",2);a([u({type:Boolean,reflect:!0})],it.prototype,"open",2);a([u({type:Number})],it.prototype,"skidding",2);a([u()],it.prototype,"trigger",2);a([u({type:Boolean})],it.prototype,"hoist",2);a([N("open",{waitUntilFirstUpdate:!0})],it.prototype,"handleOpenChange",1);a([N(["content","distance","hoist","placement","skidding"])],it.prototype,"handleOptionsChange",1);a([N("disabled")],it.prototype,"handleDisabledChange",1);St("tooltip.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:150,easing:"ease"}});St("tooltip.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:150,easing:"ease"}});it.define("sl-tooltip");Us("default",{resolver:t=>`/assets/vendor/bootstrap-icons/icons/${t}.svg`,mutator:t=>t.setAttribute("fill","currentColor")});
