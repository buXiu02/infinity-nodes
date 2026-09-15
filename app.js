(()=>{'use strict';
const $=s=>document.querySelector(s),viewport=$('#viewport'),world=$('#world'),nodesEl=$('#nodes'),edgesEl=$('#edges'),framesEl=$('#frames');
const STORAGE='infinity-nodes-v5-projects',OLD='infinity-nodes-v1',MIN_ZOOM=.2,MAX_ZOOM=3;let db=loadDB(),state=current(),selected=null,drag=null,connect=null,wheelHSV={h:220,s:.15,v:.18};let undoStack=[],redoStack=[],dragStartSnapshot=null;let multiSelected=new Set();
const selKey=(type,id)=>(type==='node'?'n:':'f:')+id;
function clearMulti(){multiSelected.clear();if(typeof multiPanel!=='undefined'&&multiPanel)multiPanel.hidden=true}
function isMulti(type,id){return multiSelected.has(selKey(type,id))}
function toggleMulti(type,id){const k=selKey(type,id);multiSelected.has(k)?multiSelected.delete(k):multiSelected.add(k);selected=multiSelected.size===1?(()=>{const v=[...multiSelected][0];return{type:v.startsWith('n:')?'node':'frame',id:v.slice(2)}})():null;closeInspectors();framePanel.hidden=true;if(multiSelected.size>1)openMultiPanel();else if(multiPanel)multiPanel.hidden=true;render()}
function beginGroupDrag(e,type,id){if(!isMulti(type,id)||multiSelected.size<2)return false;e.preventDefault();e.stopPropagation();dragStartSnapshot=projectSnapshot();const nodeOrigins=new Map(),frameOrigins=new Map();for(const k of multiSelected){if(k.startsWith('n:')){const n=nodeById(k.slice(2));if(n&&n.pinMode!=='canvas')nodeOrigins.set(n.id,{x:n.x,y:n.y})}else{const f=frameById(k.slice(2));if(f&&f.pinMode!=='canvas'){frameOrigins.set(f.id,f.points.map(p=>({...p})));for(const n of state.nodes){if(n.pinMode==='frame'&&n.pinFrameId===f.id&&n.pinMode!=='canvas'&&!nodeOrigins.has(n.id))nodeOrigins.set(n.id,{x:n.x,y:n.y})}}}}drag={type:'multi',sx:e.clientX,sy:e.clientY,nodeOrigins,frameOrigins};return true}

const themeToggle=$('#themeToggle'),colorPanel=$('#colorPanel'),wheel=$('#colorWheel'),brightness=$('#brightness'),red=$('#red'),green=$('#green'),blue=$('#blue'),preview=$('#colorPreview'),projectList=$('#projectList'),projectName=$('#projectName'),sidebar=$('#projectSidebar'),sidebarToggle=$('#sidebarToggle'),addNoteBtn=$('#addNote'),noteEditorWrap=$('#noteEditorWrap'),noteEditor=$('#noteEditor'),noteVisible=$('#noteVisible'),removeNote=$('#removeNote'),nodeType=$('#nodeType'),searchButton=$('#searchButton'),searchPanel=$('#searchPanel'),nodeSearch=$('#nodeSearch'),searchResults=$('#searchResults'),searchCaption=$('#searchCaption'),undoBtn=$('#undoBtn'),redoBtn=$('#redoBtn'),trashToggle=$('#trashToggle'),trashList=$('#trashList'),trashCount=$('#trashCount'),deleteNodeBtn=$('#deleteNodeBtn'),sidebarTitle=$('#sidebarTitle'),binBack=$('#binBack'),canvasContextMenu=$('#canvasContextMenu'),minimap=$('#minimap'),minimapCanvas=$('#minimapCanvas'),minimapToggle=$('#minimapToggle'),fitProjectBtn=$('#fitProjectBtn'),fitSelectionBtn=$('#fitSelectionBtn'),mainJumpBtn=$('#mainJumpBtn'),mainChooser=$('#mainChooser'),nodePinMode=$('#nodePinMode'),nodePinFrame=$('#nodePinFrame'),framePinMode=$('#framePinMode');let sidebarPage='projects';
const multiPanel=$('#multiPanel'),multiSummary=$('#multiSummary'),multiColorWrap=$('#multiColorWrap'),multiColor=$('#multiColor'),multiOpacity=$('#multiOpacity'),multiPinMode=$('#multiPinMode'),multiPinFrameWrap=$('#multiPinFrameWrap'),multiPinFrame=$('#multiPinFrame'),multiDelete=$('#multiDelete'),closeMultiPanel=$('#closeMultiPanel');
function multiObjects(){const nodes=[],frames=[];for(const k of multiSelected){if(k.startsWith('n:')){const n=nodeById(k.slice(2));if(n)nodes.push(n)}else{const f=frameById(k.slice(2));if(f)frames.push(f)}}return{nodes,frames}}
function commonFramesForNodes(nodes){if(!nodes.length)return[];let common=framesContainingNode(nodes[0]);for(const n of nodes.slice(1)){const ids=new Set(framesContainingNode(n).map(f=>f.id));common=common.filter(f=>ids.has(f.id))}return common}
function openMultiPanel(){if(!multiPanel||multiSelected.size<2)return;const {nodes,frames}=multiObjects(),total=nodes.length+frames.length;multiSummary.textContent=`${total} selected · ${nodes.length} node${nodes.length===1?'':'s'} · ${frames.length} frame${frames.length===1?'':'s'}`;multiColorWrap.hidden=frames.length>0||!nodes.length;if(nodes.length){const c=nodes[0].color||(db.theme==='light'?'#ffffff':'#292b31');multiColor.value=c}const vals=[...nodes.map(n=>Math.round((n.opacity??1)*100)),...frames.map(f=>Math.round((f.opacity??.18)*100))];multiOpacity.value=vals.length?vals[0]:100;const pins=[...nodes.map(n=>n.pinMode||'none'),...frames.map(f=>f.pinMode||'none')];let commonPin=pins.every(v=>v===pins[0])?pins[0]:'none';const frameOpt=multiPinMode.querySelector('option[value="frame"]'),commonFrames=(frames.length===0?commonFramesForNodes(nodes):[]);frameOpt.disabled=frames.length>0||!nodes.length||!commonFrames.length;frameOpt.textContent=commonFrames.length&&frames.length===0?'Pin to frame':'Pin to frame (same frame required)';if(commonPin==='frame'&&frameOpt.disabled)commonPin='none';multiPinMode.value=commonPin;multiPinFrame.replaceChildren();for(const f of commonFrames){const o=document.createElement('option');o.value=f.id;o.textContent=f.title||'Frame';multiPinFrame.append(o)}if(commonPin==='frame'&&nodes[0]?.pinFrameId&&commonFrames.some(f=>f.id===nodes[0].pinFrameId))multiPinFrame.value=nodes[0].pinFrameId;multiPinFrameWrap.hidden=multiPinMode.value!=='frame';multiPanel.hidden=false}
function applyMultiColor(){const {nodes,frames}=multiObjects();if(frames.length||!nodes.length)return;checkpoint();for(const n of nodes)n.color=multiColor.value;save();render();openMultiPanel()}
function applyMultiOpacity(){const {nodes,frames}=multiObjects(),v=Number(multiOpacity.value)/100;checkpoint();for(const n of nodes)n.opacity=v;for(const f of frames)f.opacity=v;save();render();openMultiPanel()}
function applyMultiPin(){const {nodes,frames}=multiObjects(),mode=multiPinMode.value;if(mode==='frame'&&(frames.length||!nodes.length))return;checkpoint();if(mode==='frame'){const common=commonFramesForNodes(nodes),fid=common.some(f=>f.id===multiPinFrame.value)?multiPinFrame.value:common[0]?.id;if(!fid)return;for(const n of nodes){n.pinMode='frame';n.pinFrameId=fid}}else{for(const n of nodes){n.pinMode=mode==='canvas'?'canvas':'none';n.pinFrameId=null}for(const f of frames)f.pinMode=mode==='canvas'?'canvas':'none'}save();render();openMultiPanel()}
multiColor.onchange=applyMultiColor;multiOpacity.onchange=applyMultiOpacity;multiPinMode.onchange=()=>{if(multiPinMode.value==='frame'){const {nodes,frames}=multiObjects(),common=frames.length?[]:commonFramesForNodes(nodes);if(!common.length){multiPinMode.value='none';return}multiPinFrameWrap.hidden=false;multiPinFrame.replaceChildren();for(const f of common){const o=document.createElement('option');o.value=f.id;o.textContent=f.title||'Frame';multiPinFrame.append(o)}}else multiPinFrameWrap.hidden=true;applyMultiPin()};multiPinFrame.onchange=applyMultiPin;closeMultiPanel.onclick=()=>{multiPanel.hidden=true};multiDelete.onclick=()=>{if(!multiSelected.size)return;checkpoint();const {nodes,frames}=multiObjects(),ns=new Set(nodes.map(n=>n.id)),fs=new Set(frames.map(f=>f.id));state.nodes=state.nodes.filter(n=>!ns.has(n.id));state.edges=state.edges.filter(e=>!ns.has(e.a)&&!ns.has(e.b));state.frames=(state.frames||[]).filter(f=>!fs.has(f.id));clearMulti();save();render()};

function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function freshProject(name='Untitled Project'){return{id:uid(),name,nodes:[],edges:[],frames:[],view:{x:innerWidth/2,y:innerHeight/2,zoom:1},updated:Date.now()}}
function loadDB(){try{let d=JSON.parse(localStorage.getItem(STORAGE));if(d?.projects?.length)return d;let old=JSON.parse(localStorage.getItem(OLD));let p=freshProject('My First Project');if(old?.nodes){Object.assign(p,{nodes:old.nodes||[],edges:old.edges||[],view:old.view||p.view});p.view.zoom=Number.isFinite(p.view.zoom)?p.view.zoom:1}return{theme:old?.theme||'dark',activeId:p.id,projects:[p]}}catch{let p=freshProject();return{theme:'dark',activeId:p.id,projects:[p]}}}
function current(){let p=db.projects.find(x=>x.id===db.activeId);if(!p){p=db.projects[0]||freshProject();if(!db.projects.length)db.projects.push(p);db.activeId=p.id}return p}
function save(){state.updated=Date.now();db.trash=db.trash||[];localStorage.setItem(STORAGE,JSON.stringify(db));updateHistoryButtons()}
function projectSnapshot(){return JSON.stringify({nodes:state.nodes,edges:state.edges,frames:state.frames||[],view:state.view,name:state.name})}
function restoreSnapshot(raw){let x=JSON.parse(raw);state.nodes=x.nodes||[];state.edges=x.edges||[];state.frames=x.frames||[];state.view=x.view||state.view;state.name=x.name||state.name;selected=null;closeInspectors?.();save();renderProjects();render()}
function checkpoint(raw=projectSnapshot()){if(undoStack.at(-1)!==raw)undoStack.push(raw);if(undoStack.length>100)undoStack.shift();redoStack=[];updateHistoryButtons()}
function updateHistoryButtons(){if(!undoBtn)return;undoBtn.disabled=!undoStack.length;redoBtn.disabled=!redoStack.length}
function undo(){if(!undoStack.length)return;redoStack.push(projectSnapshot());restoreSnapshot(undoStack.pop())}
function redo(){if(!redoStack.length)return;undoStack.push(projectSnapshot());restoreSnapshot(redoStack.pop())}
function resetHistory(){undoStack=[];redoStack=[];updateHistoryButtons()}
function screenToWorld(x,y){let z=state.view.zoom;return{x:(x-state.view.x)/z,y:(y-state.view.y)/z}}
function applyView(){let z=state.view.zoom;world.style.transform=`translate(${state.view.x}px,${state.view.y}px) scale(${z})`;applyBackground()}
function nodeById(i){return state.nodes.find(n=>n.id===i)}
function addNode(x,y,text='New node'){checkpoint();let n={id:uid(),x,y,text,color:null,note:null,type:'standard',tags:[]};state.nodes.push(n);save();render();setTimeout(()=>{let t=document.querySelector(`[data-id="${n.id}"] .title`);t?.focus();document.execCommand?.('selectAll',false,null)},0)}
function renderProjects(){db.trash=db.trash||[];projectList.replaceChildren();for(let p of [...db.projects].sort((a,b)=>b.updated-a.updated)){let row=document.createElement('div');row.className='project-row'+(p.id===db.activeId?' active':'');let b=document.createElement('button');b.className='project-item'+(p.id===db.activeId?' active':'');b.textContent=p.name||'Untitled Project';b.title=p.name;b.onclick=()=>switchProject(p.id);row.append(b);if(p.id===db.activeId){let del=document.createElement('button');del.className='project-delete';del.title='Move project to Bin';del.setAttribute('aria-label','Move project to Bin');del.innerHTML='<svg viewBox="0 0 24 24"><path d="M8 9v8M16 9v8M5 6h14M9 6V4h6v2M7 6l1 14h8l1-14"/></svg>';del.onclick=e=>{e.stopPropagation();trashProject(p.id)};row.append(del)}projectList.append(row)}projectName.value=state.name||'Untitled Project';renderTrash();renderSidebarPage()}
function renderTrash(){trashCount.textContent=db.trash.length;trashList.replaceChildren();if(!db.trash.length){let empty=document.createElement('div');empty.className='trash-empty';empty.textContent='Bin is empty';trashList.append(empty)}for(const p of [...db.trash].sort((a,b)=>(b.deletedAt||0)-(a.deletedAt||0))){let item=document.createElement('div');item.className='trash-item';let name=document.createElement('div');name.className='trash-name';name.textContent=p.name||'Untitled Project';let actions=document.createElement('div');actions.className='trash-actions';let restore=document.createElement('button');restore.textContent='Restore';restore.onclick=()=>restoreProject(p.id);let gone=document.createElement('button');gone.className='permanent';gone.textContent='Delete permanently';gone.onclick=()=>permanentDeleteProject(p.id);actions.append(restore,gone);item.append(name,actions);trashList.append(item)}}
function renderSidebarPage(){let inBin=sidebarPage==='bin';sidebarTitle.textContent=inBin?'Bin':'Projects';projectList.hidden=inBin;trashList.hidden=!inBin;trashToggle.closest('.trash-section').hidden=inBin;binBack.hidden=!inBin;$('#newProject').hidden=inBin;sidebar.classList.toggle('bin-page',inBin)}
function openBin(){sidebarPage='bin';if(sidebar.classList.contains('collapsed')){sidebar.classList.remove('collapsed');localStorage.setItem('infinity-nodes-sidebar','open')}renderSidebarPage()}
function closeBin(){sidebarPage='projects';renderSidebarPage()}
function trashProject(id){let i=db.projects.findIndex(p=>p.id===id);if(i<0)return;let p=db.projects.splice(i,1)[0];p.deletedAt=Date.now();db.trash.push(p);sidebarPage='projects';if(db.activeId===id){if(!db.projects.length)db.projects.push(freshProject('Untitled Project'));db.activeId=db.projects[0].id;state=current();selected=null;closeInspectors?.();resetHistory();render()}save();renderProjects()}
function restoreProject(id){let i=db.trash.findIndex(p=>p.id===id);if(i<0)return;let p=db.trash.splice(i,1)[0];delete p.deletedAt;p.updated=Date.now();db.projects.push(p);save();renderProjects()}
function permanentDeleteProject(id){let p=db.trash.find(x=>x.id===id);if(!p)return;if(!confirm(`Permanently delete “${p.name||'Untitled Project'}”? This cannot be undone.`))return;db.trash=db.trash.filter(x=>x.id!==id);save();renderProjects()}
function switchProject(pid){save();resetHistory();clearMulti();db.activeId=pid;state=current();selected=drag=connect=null;colorPanel.hidden=true;edgePanel.hidden=true;save();renderProjects();render()}
function newProject(){save();resetHistory();clearMulti();let p=freshProject(`Project ${db.projects.length+1}`);db.projects.push(p);db.activeId=p.id;state=p;selected=null;colorPanel.hidden=true;edgePanel.hidden=true;save();renderProjects();render();projectName.focus();projectName.select()}
function normaliseNode(n){if(!Array.isArray(n.tags))n.tags=[];n.tags=[...new Set(n.tags.map(t=>String(t).trim().replace(/^#+/,'')).filter(Boolean))];if(!['standard','main','parent','title'].includes(n.type))n.type='standard';if(n.portalProjectId!==null&&typeof n.portalProjectId!=='string')n.portalProjectId=null;if(typeof n.portalNodeId!=='string'||!n.portalNodeId||n.portalNodeId===n.id||n.portalProjectId)n.portalNodeId=null;if(!Number.isFinite(n.opacity))n.opacity=1;if(n.imageData){if(!Number.isFinite(n.imageWidth))n.imageWidth=240;if(!Number.isFinite(n.imageHeight))n.imageHeight=180;}if(!['none','canvas','frame'].includes(n.pinMode))n.pinMode='none';if(n.pinMode!=='frame')n.pinFrameId=null;normaliseNote(n);return n}
function normaliseNote(n){if(n.note===undefined){let old=Array.isArray(n.notes)&&n.notes[0];n.note=old?{text:old.text||'',visible:true}:null;delete n.notes}return n.note}
function render(){applyBackground();applyView();renderFrames();nodesEl.replaceChildren();for(const n of state.nodes){normaliseNode(n);let el=document.createElement('div');el.className='node'+((selected?.type==='node'&&selected.id===n.id)||isMulti('node',n.id)?' selected':'');el.dataset.id=n.id;el.dataset.nodeType=n.type||'standard';el.dataset.pinned=n.pinMode||'none';el.style.left=n.x+'px';el.style.top=n.y+'px';el.style.opacity=n.opacity??1;if(n.imageData){el.style.width=n.imageWidth+'px';el.style.maxWidth='none';}if(n.color){el.style.setProperty('--node-custom',n.color);el.style.background=n.color;el.style.setProperty('--node-header',shade(n.color,-18));el.style.setProperty('--node-text',contrast(n.color))}let header=document.createElement('div');header.className='node-header';header.title='Drag to move';header.onpointerdown=startNodeDrag;let title=document.createElement('div');title.className='title';title.contentEditable='true';title.spellcheck=false;title.textContent=n.text;title.onfocus=()=>{title.dataset.before=projectSnapshot()};title.oninput=()=>{n.text=title.textContent;save();drawEdges()};title.onblur=()=>{let before=title.dataset.before;if(before&&before!==projectSnapshot())checkpoint(before);delete title.dataset.before};title.onpointerdown=e=>e.stopPropagation();let port=document.createElement('div');port.className='port';port.title='Drag to connect';port.onpointerdown=startConnect;el.append(header,title,port);if(n.tags?.length){let tw=document.createElement('div');tw.className='node-tags';for(const tag of n.tags){let t=document.createElement('span');t.className='node-tag';t.textContent='#'+tag;tw.append(t)}el.append(tw)}if(n.portalProjectId||n.portalNodeId){let pb=document.createElement('button');pb.className='portal-badge';pb.type='button';pb.title=n.portalNodeId?'Focus linked node':'Open linked project';pb.setAttribute('aria-label',pb.title);pb.innerHTML='<svg viewBox="0 0 24 24"><path d="M9 7h8v8M17 7 8 16"/></svg>';pb.onclick=e=>{e.stopPropagation();openNodeDestination(n)};el.append(pb);el.ondblclick=e=>{if(!e.target.classList.contains('title')){e.stopPropagation();openNodeDestination(n)}}}if(n.note?.visible){let ne=document.createElement('div');ne.className='node-note';ne.textContent=n.note.text||'';ne.title='Attached note — edit it from the node panel';el.append(ne)}el.onclick=e=>{if(!e.target.classList.contains('title')&&!e.target.classList.contains('port')){e.stopPropagation();if(e.shiftKey){toggleMulti('node',n.id);return}clearMulti();selected={type:'node',id:n.id};edgePanel.hidden=true;framePanel.hidden=true;openColor(n);render()}};if(n.imageData){let im=document.createElement('img');im.className='node-image';im.src=n.imageData;im.alt='';im.draggable=false;im.style.height=n.imageHeight+'px';el.insertBefore(im,el.querySelector('.node-body')||el.children[1]||null);let rh=document.createElement('div');rh.className='image-resize-handle';rh.title='Drag to resize image';rh.onpointerdown=ev=>startImageResize(ev,n,el);el.append(rh);}nodesEl.append(el)}drawEdges()}
function center(n){let el=document.querySelector(`[data-id="${n.id}"]`);return{x:n.x+(el?.offsetWidth||150)/2,y:n.y+(el?.offsetHeight||40)/2}}
function drawEdges(){edgesEl.replaceChildren();for(const e of state.edges){let a=nodeById(e.a),b=nodeById(e.b);if(!a||!b)continue;let p=center(a),q=center(b),path=document.createElementNS('http://www.w3.org/2000/svg','path'),dx=Math.max(50,Math.abs(q.x-p.x)*.45);path.setAttribute('d',`M ${p.x+100000} ${p.y+100000} C ${p.x+dx+100000} ${p.y+100000}, ${q.x-dx+100000} ${q.y+100000}, ${q.x+100000} ${q.y+100000}`);path.setAttribute('class','edge'+(selected?.type==='edge'&&selected.id===e.id?' selected':''));path.style.pointerEvents='stroke';path.onpointerdown=ev=>{ev.stopPropagation();selected={type:'edge',id:e.id};render()};edgesEl.append(path)}if(connect){let a=nodeById(connect.from),p=center(a),q=screenToWorld(connect.x,connect.y),path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${p.x+100000} ${p.y+100000} C ${p.x+80+100000} ${p.y+100000}, ${q.x-80+100000} ${q.y+100000}, ${q.x+100000} ${q.y+100000}`);path.setAttribute('class','edge');edgesEl.append(path)}}
function startImageResize(e,n,el){if(e.button!==0)return;e.preventDefault();e.stopPropagation();clearMulti();selected={type:'node',id:n.id};const handle=e.currentTarget;handle.setPointerCapture?.(e.pointerId);let snap=projectSnapshot(),sx=e.clientX,sy=e.clientY,sw=n.imageWidth||240,sh=n.imageHeight||180;const move=ev=>{n.imageWidth=Math.max(120,sw+(ev.clientX-sx)/state.view.zoom);n.imageHeight=Math.max(80,sh+(ev.clientY-sy)/state.view.zoom);el.style.width=n.imageWidth+'px';let im=el.querySelector('.node-image');if(im)im.style.height=n.imageHeight+'px';drawEdges()};const up=ev=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);try{handle.releasePointerCapture?.(e.pointerId)}catch{}if(snap!==projectSnapshot())checkpoint(snap);save();render()};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up)}
function startNodeDrag(e){if(e.button!==0)return;let el=e.currentTarget.closest('.node'),n=nodeById(el.dataset.id);if(e.shiftKey){e.preventDefault();e.stopPropagation();toggleMulti('node',n.id);return}if(beginGroupDrag(e,'node',n.id))return;e.preventDefault();e.stopPropagation();clearMulti();selected={type:'node',id:n.id};if(n.pinMode==='canvas'){openColor(n);render();return}dragStartSnapshot=projectSnapshot();drag={type:'node',id:n.id,sx:e.clientX,sy:e.clientY,ox:n.x,oy:n.y};el.classList.add('dragging');el.setPointerCapture?.(e.pointerId)}
function startConnect(e){e.stopPropagation();let el=e.currentTarget.closest('.node');connect={from:el.dataset.id,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture?.(e.pointerId);drawEdges()}
viewport.ondblclick=e=>{if(frameDraw){finishFrameDraw();return}if(e.target===viewport){let p=screenToWorld(e.clientX,e.clientY);addNode(p.x,p.y)}};viewport.onpointerdown=e=>{if(e.button!==0||e.target!==viewport)return;if(frameDraw){let p=screenToWorld(e.clientX,e.clientY);frameDraw.points.push({x:p.x,y:p.y});renderFrameDraft();return}selected=null;clearMulti();colorPanel.hidden=true;edgePanel.hidden=true;framePanel.hidden=true;drag={type:'pan',sx:e.clientX,sy:e.clientY,ox:state.view.x,oy:state.view.y};viewport.classList.add('panning');viewport.setPointerCapture?.(e.pointerId);render()};viewport.addEventListener('wheel',e=>{e.preventDefault();let old=state.view.zoom,next=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,old*Math.exp(-e.deltaY*.0015)));if(next===old)return;let wx=(e.clientX-state.view.x)/old,wy=(e.clientY-state.view.y)/old;state.view.zoom=next;state.view.x=e.clientX-wx*next;state.view.y=e.clientY-wy*next;applyView();save()},{passive:false});
addEventListener('pointermove',e=>{if(connect){connect.x=e.clientX;connect.y=e.clientY;drawEdges();return}if(!drag)return;if(drag.type==='pan'){state.view.x=drag.ox+e.clientX-drag.sx;state.view.y=drag.oy+e.clientY-drag.sy;applyView()}else if(drag.type==='node'){let n=nodeById(drag.id),z=state.view.zoom;n.x=drag.ox+(e.clientX-drag.sx)/z;n.y=drag.oy+(e.clientY-drag.sy)/z;let el=document.querySelector(`[data-id="${n.id}"]`);if(el){el.style.left=n.x+'px';el.style.top=n.y+'px'}drawEdges()}else if(drag.type==='multi'){let z=state.view.zoom,dx=(e.clientX-drag.sx)/z,dy=(e.clientY-drag.sy)/z;for(const [id,o] of drag.nodeOrigins){let n=nodeById(id);if(n){n.x=o.x+dx;n.y=o.y+dy;let el=document.querySelector(`[data-id="${id}"]`);if(el){el.style.left=n.x+'px';el.style.top=n.y+'px'}}}for(const [id,pts] of drag.frameOrigins){let f=frameById(id);if(f)f.points=pts.map(p=>({x:p.x+dx,y:p.y+dy}))}renderFrames();drawEdges()}else if(drag.type==='frame'){let f=frameById(drag.id),z=state.view.zoom,dx=(e.clientX-drag.sx)/z,dy=(e.clientY-drag.sy)/z;f.points=drag.points.map(p=>({x:p.x+dx,y:p.y+dy}));for(const n of state.nodes){if(n.pinMode==='frame'&&n.pinFrameId===f.id){if(!drag.nodeOrigins)drag.nodeOrigins=new Map(state.nodes.filter(x=>x.pinMode==='frame'&&x.pinFrameId===f.id).map(x=>[x.id,{x:x.x,y:x.y}]));let o=drag.nodeOrigins.get(n.id);if(o){n.x=o.x+dx;n.y=o.y+dy;let el=document.querySelector(`[data-id="${n.id}"]`);if(el){el.style.left=n.x+'px';el.style.top=n.y+'px'}}}}renderFrames();drawEdges()}else if(drag.type==='frame-vertex'){let f=frameById(drag.id),z=state.view.zoom,p=f.points[drag.index];p.x=drag.opx+(e.clientX-drag.sx)/z;p.y=drag.opy+(e.clientY-drag.sy)/z;renderFrames()}});addEventListener('pointerup',e=>{if(connect){let target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.node');if(target&&target.dataset.id!==connect.from&&!state.edges.some(x=>(x.a===connect.from&&x.b===target.dataset.id)||(x.b===connect.from&&x.a===target.dataset.id))) {checkpoint();state.edges.push({id:uid(),a:connect.from,b:target.dataset.id})}connect=null;save();render()}if(drag){if((drag.type==='node'||drag.type==='frame'||drag.type==='frame-vertex'||drag.type==='multi')&&dragStartSnapshot&&dragStartSnapshot!==projectSnapshot())checkpoint(dragStartSnapshot);dragStartSnapshot=null;document.querySelector('.node.dragging')?.classList.remove('dragging');drag=null;viewport.classList.remove('panning');save()}});
function isEditingText(){const a=document.activeElement;return !!a&&(a.matches?.('input, textarea, select')||a.isContentEditable)}
addEventListener('keydown',e=>{if(frameDraw&&(e.key==='Enter'||e.key==='Escape')){e.preventDefault();if(e.key==='Enter')finishFrameDraw();else{frameDraw=null;document.body.classList.remove('drawing-frame');$('#addFrameBtn').textContent='Frame';renderFrames()}return}if((e.key==='Delete'||e.key==='Backspace')&&!isEditingText()&&(selected||multiSelected.size)){checkpoint();if(multiSelected.size){const nodeIds=new Set([...multiSelected].filter(k=>k.startsWith('n:')).map(k=>k.slice(2))),frameIds=new Set([...multiSelected].filter(k=>k.startsWith('f:')).map(k=>k.slice(2)));state.nodes=state.nodes.filter(n=>!nodeIds.has(n.id));state.edges=state.edges.filter(x=>!nodeIds.has(x.a)&&!nodeIds.has(x.b));state.frames=(state.frames||[]).filter(f=>!frameIds.has(f.id));clearMulti()}else if(selected.type==='node'){state.nodes=state.nodes.filter(n=>n.id!==selected.id);state.edges=state.edges.filter(x=>x.a!==selected.id&&x.b!==selected.id)}else if(selected.type==='frame'){state.frames=(state.frames||[]).filter(f=>f.id!==selected.id)}else state.edges=state.edges.filter(x=>x.id!==selected.id);selected=null;colorPanel.hidden=true;edgePanel.hidden=true;framePanel.hidden=true;save();render()}});
function clamp(v){return Math.max(0,Math.min(255,Number(v)||0))}function hexToRgb(h){h=h.replace('#','');return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}}function rgbToHex(r,g,b){return'#'+[r,g,b].map(v=>clamp(v).toString(16).padStart(2,'0')).join('')}function shade(hex,a){let c=hexToRgb(hex);return rgbToHex(c.r+a,c.g+a,c.b+a)}function contrast(hex){let c=hexToRgb(hex);return(c.r*299+c.g*587+c.b*114)/1000>150?'#17191d':'#f7f7f8'}
function rgbToHsv(r,g,b){r/=255;g/=255;b/=255;let mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360}return{h,s:mx?d/mx:0,v:mx}}
function hsvToRgb(h,s,v){let c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r=0,g=0,b=0;if(h<60)[r,g,b]=[c,x,0];else if(h<120)[r,g,b]=[x,c,0];else if(h<180)[r,g,b]=[0,c,x];else if(h<240)[r,g,b]=[0,x,c];else if(h<300)[r,g,b]=[x,0,c];else[r,g,b]=[c,0,x];return{r:Math.round((r+m)*255),g:Math.round((g+m)*255),b:Math.round((b+m)*255)}}
function drawWheel(){let ctx=wheel.getContext('2d'),w=wheel.width,c=w/2,r=c-10;ctx.clearRect(0,0,w,w);let ang=wheelHSV.h*Math.PI/180,px=c+Math.cos(ang)*wheelHSV.s*r,py=c+Math.sin(ang)*wheelHSV.s*r;ctx.beginPath();ctx.arc(px,py,12,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.98)';ctx.lineWidth=6;ctx.stroke();ctx.beginPath();ctx.arc(px,py,16,0,Math.PI*2);ctx.strokeStyle='rgba(0,0,0,.48)';ctx.lineWidth=2;ctx.stroke()}
function syncNotePanel(n){normaliseNote(n);let has=!!n.note;addNoteBtn.hidden=has;noteEditorWrap.hidden=!has;if(has){noteEditor.value=n.note.text||'';noteVisible.checked=n.note.visible!==false}}
function openColor(n){if(imageEditorWrap)imageEditorWrap.hidden=!n.imageData;if(attachImageBtn)attachImageBtn.hidden=!!n.imageData;normaliseNode(n);syncNodeTags(n);nodeType.value=n.type||'standard';syncNodePortalPanel(n);syncNodePinPanel(n);nodeOpacity.value=Math.round((n.opacity??1)*100);syncNotePanel(n);let fallback=db.theme==='light'?'#ffffff':'#292b31',hex=n.color||fallback,c=hexToRgb(hex);wheelHSV=rgbToHsv(c.r,c.g,c.b);brightness.value=Math.round(wheelHSV.v*100);red.value=c.r;green.value=c.g;blue.value=c.b;preview.style.background=hex;colorPanel.hidden=false;drawWheel()}
function setColor(hex,updateHSV=true){if(selected?.type!=='node')return;let n=nodeById(selected.id);n.color=hex;let c=hexToRgb(hex);red.value=c.r;green.value=c.g;blue.value=c.b;preview.style.background=hex;if(updateHSV){wheelHSV=rgbToHsv(c.r,c.g,c.b);brightness.value=Math.round(wheelHSV.v*100);drawWheel()}save();render();colorPanel.hidden=false}
function pickWheel(e){let rect=wheel.getBoundingClientRect(),scale=wheel.width/rect.width,x=(e.clientX-rect.left)*scale,y=(e.clientY-rect.top)*scale,c=wheel.width/2,dx=x-c,dy=y-c,r=c-10,rr=Math.sqrt(dx*dx+dy*dy);if(rr>r)return;wheelHSV.h=(Math.atan2(dy,dx)*180/Math.PI+360)%360;wheelHSV.s=Math.min(1,rr/r);let rgb=hsvToRgb(wheelHSV.h,wheelHSV.s,wheelHSV.v);setColor(rgbToHex(rgb.r,rgb.g,rgb.b),false);drawWheel()}
wheel.onpointerdown=e=>{wheel.setPointerCapture?.(e.pointerId);pickWheel(e)};wheel.onpointermove=e=>{if(e.buttons&1)pickWheel(e)};brightness.oninput=()=>{wheelHSV.v=brightness.value/100;let c=hsvToRgb(wheelHSV.h,wheelHSV.s,wheelHSV.v);setColor(rgbToHex(c.r,c.g,c.b),false)};[red,green,blue].forEach(inp=>inp.oninput=()=>setColor(rgbToHex(red.value,green.value,blue.value),true));
function applySidebar(){let collapsed=localStorage.getItem('infinity-nodes-sidebar-collapsed')==='1';sidebar.classList.toggle('collapsed',collapsed);document.body.classList.toggle('sidebar-collapsed',collapsed);sidebarToggle.innerHTML='<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m14.5 6-6 6 6 6\"/></svg>'; sidebarToggle.title=collapsed?'Expand projects':'Collapse projects';sidebarToggle.setAttribute('aria-label',sidebarToggle.title)}sidebarToggle.onclick=e=>{e.stopPropagation();let next=!sidebar.classList.contains('collapsed');localStorage.setItem('infinity-nodes-sidebar-collapsed',next?'1':'0');applySidebar()};
function themeIcon(light){return light?'<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z\"/></svg>':'<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"3.5\"/><path d=\"M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42\"/></svg>'}
function applyTheme(){document.documentElement.classList.toggle('light',db.theme==='light');themeToggle.innerHTML=themeIcon(db.theme==='light');themeToggle.title=db.theme==='light'?'Switch to dark theme':'Switch to light theme'}themeToggle.onclick=e=>{e.stopPropagation();db.theme=db.theme==='light'?'dark':'light';applyTheme();save();render()};
const nodeOpacity=$('#nodeOpacity');nodeOpacity.oninput=()=>{if(selected?.type!=='node')return;let n=nodeById(selected.id);if(!n)return;n.opacity=Number(nodeOpacity.value)/100;save();let el=document.querySelector(`[data-id=\"${n.id}\"]`);if(el)el.style.opacity=n.opacity};
const panelDragHandle=$('#panelDragHandle');let panelDrag=null;
function clampPanelPosition(x,y){const r=colorPanel.getBoundingClientRect(),pad=8;return{x:Math.max(pad,Math.min(innerWidth-r.width-pad,x)),y:Math.max(pad,Math.min(innerHeight-r.height-pad,y))}}
function restorePanelPosition(){try{const pos=JSON.parse(localStorage.getItem('infinity-nodes-inspector-position'));if(pos&&Number.isFinite(pos.x)&&Number.isFinite(pos.y)){colorPanel.style.left=pos.x+'px';colorPanel.style.top=pos.y+'px';colorPanel.style.right='auto'}}catch{}}
panelDragHandle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();const r=colorPanel.getBoundingClientRect();panelDrag={sx:e.clientX,sy:e.clientY,ox:r.left,oy:r.top,id:e.pointerId};panelDragHandle.setPointerCapture?.(e.pointerId);colorPanel.classList.add('panel-dragging')};
panelDragHandle.onpointermove=e=>{if(!panelDrag||e.pointerId!==panelDrag.id)return;const pos=clampPanelPosition(panelDrag.ox+e.clientX-panelDrag.sx,panelDrag.oy+e.clientY-panelDrag.sy);colorPanel.style.left=pos.x+'px';colorPanel.style.top=pos.y+'px';colorPanel.style.right='auto'};
panelDragHandle.onpointerup=e=>{if(!panelDrag)return;const r=colorPanel.getBoundingClientRect();localStorage.setItem('infinity-nodes-inspector-position',JSON.stringify({x:r.left,y:r.top}));panelDrag=null;colorPanel.classList.remove('panel-dragging')};
addEventListener('resize',()=>{if(colorPanel.hidden)return;const r=colorPanel.getBoundingClientRect(),pos=clampPanelPosition(r.left,r.top);colorPanel.style.left=pos.x+'px';colorPanel.style.top=pos.y+'px';colorPanel.style.right='auto'});
restorePanelPosition();
const nodeTagsList=$('#nodeTagsList'),nodeTagInput=$('#nodeTagInput'),addNodeTag=$('#addNodeTag');
function cleanTag(v){return String(v||'').trim().replace(/^#+/,'').replace(/\s+/g,'-').slice(0,40)}
function syncNodeTags(n){if(!nodeTagsList)return;normaliseNode(n);nodeTagsList.replaceChildren();for(const tag of n.tags){let chip=document.createElement('span');chip.className='tag-chip';let txt=document.createElement('span');txt.textContent='#'+tag;let x=document.createElement('button');x.type='button';x.textContent='×';x.title='Remove tag';x.onclick=()=>{checkpoint();n.tags=n.tags.filter(t=>t!==tag);save();render();colorPanel.hidden=false;syncNodeTags(n);renderSearchResults()};chip.append(txt,x);nodeTagsList.append(chip)}}
function addTagToSelected(){if(selected?.type!=='node')return;let n=nodeById(selected.id),raw=nodeTagInput.value;if(!n)return;let parts=raw.split(',').map(cleanTag).filter(Boolean);if(!parts.length)return;checkpoint();normaliseNode(n);for(const tag of parts)if(!n.tags.some(t=>t.toLocaleLowerCase()===tag.toLocaleLowerCase()))n.tags.push(tag);nodeTagInput.value='';save();render();colorPanel.hidden=false;syncNodeTags(n);renderSearchResults();nodeTagInput.focus()}
if(addNodeTag)addNodeTag.onclick=addTagToSelected;if(nodeTagInput)nodeTagInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addTagToSelected()}};
nodeType.onchange=()=>{if(selected?.type!=='node')return;let n=nodeById(selected.id);if(!n)return;n.type=nodeType.value;save();render();colorPanel.hidden=false;nodeType.value=n.type;renderSearchResults()};
addNoteBtn.onclick=()=>{if(selected?.type!=='node')return;let n=nodeById(selected.id);n.note={text:'',visible:true};save();syncNotePanel(n);render();colorPanel.hidden=false;noteEditor.focus()};noteEditor.oninput=()=>{if(selected?.type!=='node')return;let n=nodeById(selected.id);if(!n.note)return;n.note.text=noteEditor.value;save();if(n.note.visible){const noteEl=document.querySelector(`[data-id="${n.id}"] .node-note`);if(noteEl)noteEl.textContent=n.note.text||'';drawEdges()}};noteVisible.onchange=()=>{if(selected?.type!=='node')return;let n=nodeById(selected.id);if(!n.note)return;n.note.visible=noteVisible.checked;save();render();colorPanel.hidden=false;syncNotePanel(n)};removeNote.onclick=()=>{if(selected?.type!=='node')return;let n=nodeById(selected.id);n.note=null;save();render();colorPanel.hidden=false;syncNotePanel(n)};
function renderSearchResults(){
  if(!searchResults)return;
  const q=(nodeSearch.value||'').trim().toLocaleLowerCase();
  let list=q?state.nodes.filter(n=>(n.text||'').toLocaleLowerCase().includes(q)||(n.tags||[]).some(t=>('#'+t).toLocaleLowerCase().includes(q)||t.toLocaleLowerCase().includes(q))):state.nodes.filter(n=>(n.type||'standard')==='main');
  list=[...list].sort((a,b)=>{if(q){const am=(a.type==='main'),bm=(b.type==='main');if(am!==bm)return am?-1:1}return (a.text||'').localeCompare(b.text||'')});
  searchCaption.textContent=q?'Search results':'Main nodes';searchResults.replaceChildren();
  if(!list.length){let e=document.createElement('div');e.className='search-empty';e.textContent=q?'No matching nodes':'No main nodes yet';searchResults.append(e);return}
  for(const n of list){let b=document.createElement('button');b.type='button';b.className='search-result';let name=document.createElement('span');name.className='search-result-name';name.textContent=n.text||'Untitled node';let type=document.createElement('span');type.className='search-result-type';type.textContent=n.type||'standard';b.append(name,type);if(n.tags?.length){let tags=document.createElement('span');tags.className='search-result-tags';tags.textContent=n.tags.map(t=>'#'+t).join(' ');b.append(tags)}b.onclick=()=>focusNode(n.id);searchResults.append(b)}
}
function openSearch(){searchPanel.hidden=false;renderSearchResults();requestAnimationFrame(()=>{nodeSearch.focus();nodeSearch.select()})}
function closeSearch(){searchPanel.hidden=true;nodeSearch.value=''}
function focusNode(id){const n=nodeById(id);if(!n)return;const el=document.querySelector(`[data-id="${id}"]`);const w=el?.offsetWidth||160,h=el?.offsetHeight||55,z=Math.max(state.view.zoom,.75);state.view.zoom=Math.min(1.35,z);state.view.x=innerWidth/2-(n.x+w/2)*state.view.zoom;state.view.y=innerHeight/2-(n.y+h/2)*state.view.zoom;selected={type:'node',id};save();render();closeSearch();setTimeout(()=>{const target=document.querySelector(`[data-id="${id}"]`);target?.classList.add('focus-flash');setTimeout(()=>target?.classList.remove('focus-flash'),1300)},20)}
function contentBounds(){let xs=[],ys=[];for(const n of state.nodes){xs.push(n.x,n.x+180);ys.push(n.y,n.y+90)}for(const f of (state.frames||[]))for(const p of normaliseFrame(f).points){xs.push(p.x);ys.push(p.y)}if(!xs.length)return{x:0,y:0,w:800,h:500};let minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);return{x:minx,y:miny,w:Math.max(120,maxx-minx),h:Math.max(100,maxy-miny)}}
function fitBounds(b,pad=90){let vw=innerWidth-(sidebar.classList.contains('collapsed')?52:220),vh=innerHeight;let z=Math.min(1.6,Math.max(.12,Math.min((vw-pad*2)/b.w,(vh-pad*2)/b.h)));state.view.zoom=z;state.view.x=(sidebar.classList.contains('collapsed')?52:220)+(vw-b.w*z)/2-b.x*z;state.view.y=(vh-b.h*z)/2-b.y*z;save();render()}
function fitProject(){fitBounds(contentBounds())}
function fitSelection(){if(!selected)return fitProject();if(selected.type==='node'){let n=nodeById(selected.id);if(n)fitBounds({x:n.x-40,y:n.y-40,w:260,h:170},120)}else if(selected.type==='frame'){let f=frameById(selected.id);if(f)fitBounds(frameBounds(f),100)}}

searchButton.onclick=e=>{e.stopPropagation();searchPanel.hidden?openSearch():closeSearch()};searchPanel.onpointerdown=e=>e.stopPropagation();nodeSearch.oninput=renderSearchResults;nodeSearch.onkeydown=e=>{if(e.key==='Escape'){closeSearch();searchButton.focus()}else if(e.key==='Enter'){const first=searchResults.querySelector('.search-result');first?.click()}};
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();openSearch()}else if(e.key==='Escape'&&!searchPanel.hidden)closeSearch()});
addEventListener('pointerdown',e=>{if(!searchPanel.hidden&&!searchPanel.contains(e.target)&&e.target!==searchButton)closeSearch()});
deleteNodeBtn.onclick=()=>{if(selected?.type!=='node')return;checkpoint();let id=selected.id;state.nodes=state.nodes.filter(n=>n.id!==id);state.edges=state.edges.filter(e=>e.a!==id&&e.b!==id);selected=null;closeInspectors();save();render()};undoBtn.onclick=undo;redoBtn.onclick=redo;trashToggle.onclick=openBin;binBack.onclick=closeBin;addEventListener('keydown',e=>{if(isEditingText())return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}});
addEventListener('keydown',e=>{if(isEditingText())return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();multiSelected=new Set([...state.nodes.map(n=>'n:'+n.id),...(state.frames||[]).map(f=>'f:'+f.id)]);selected=null;closeInspectors();framePanel.hidden=true;openMultiPanel();render()}else if(e.key==='Escape'&&multiSelected.size){clearMulti();selected=null;render()}});
$('#closeColor').onclick=()=>colorPanel.hidden=true;colorPanel.onpointerdown=e=>e.stopPropagation();$('#newProject').onclick=newProject;$('#saveProject').onclick=()=>{state.name=(projectName.value.trim()||'Untitled Project');save();renderProjects();let b=$('#saveProject');let old=b.textContent;b.textContent='Saved ✓';setTimeout(()=>b.textContent=old,900)};projectName.onkeydown=e=>{if(e.key==='Enter'){$('#saveProject').click();projectName.blur()}};addEventListener('beforeunload',save);


// V11 FIXED — portable exports
const exportBtn=$('#exportProject'),exportMenu=$('#exportMenu');
function safeName(s){return (s||'Infinity Nodes').replace(/[\\/:*?"<>|]+/g,'-').trim()||'Infinity Nodes'}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function exportBounds(){
  if(!state.nodes.length)return{x:-500,y:-350,w:1000,h:700};
  const pad=90;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const n of state.nodes){
    minX=Math.min(minX,n.x);minY=Math.min(minY,n.y);
    maxX=Math.max(maxX,n.x+150+(n.note?.visible?180:0));
    maxY=Math.max(maxY,n.y+Math.max(80,n.note?.visible?130:80));
  }
  return{x:minX-pad,y:minY-pad,w:Math.max(500,maxX-minX+pad*2),h:Math.max(350,maxY-minY+pad*2)};
}
function projectSVG(){
  const b=exportBounds(),map=new Map(state.nodes.map(n=>[n.id,n]));
  const edgeMarkup=state.edges.map(e=>{const a=map.get(e.a),z=map.get(e.b);if(!a||!z)return'';const x1=a.x+75,y1=a.y+47,x2=z.x+75,y2=z.y+47,dx=Math.max(50,Math.abs(x2-x1)*.45);return `<path d="M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}" fill="none" stroke="#8b9099" stroke-width="2"/>`}).join('');
  const nodeMarkup=state.nodes.map(n=>{const fill=n.color||'#292b31',head=n.color?shade(n.color,-18):'#343740',txt=n.color?contrast(n.color):'#f2f2f3';const note=n.note?.visible&&n.note.text?`<foreignObject x="${n.x+160}" y="${n.y+25}" width="170" height="110"><div xmlns="http://www.w3.org/1999/xhtml" style="font:italic 11px/1.4 Arial,sans-serif;color:#34363b;background:#fff;border:1px solid #bbb;border-radius:8px;padding:8px;overflow-wrap:anywhere">${esc(n.note.text)}</div></foreignObject>`:'';return `<g><rect x="${n.x}" y="${n.y}" width="150" height="76" rx="8" fill="${fill}" stroke="#666"/><path d="M${n.x+8} ${n.y}H${n.x+142}Q${n.x+150} ${n.y} ${n.x+150} ${n.y+8}V${n.y+18}H${n.x}V${n.y+8}Q${n.x} ${n.y} ${n.x+8} ${n.y}Z" fill="${head}"/><foreignObject x="${n.x+10}" y="${n.y+26}" width="130" height="42"><div xmlns="http://www.w3.org/1999/xhtml" style="font:14px Arial,sans-serif;color:${txt};overflow-wrap:anywhere;white-space:pre-wrap">${esc(n.text)}</div></foreignObject>${note}</g>`}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${Math.ceil(b.w)}" height="${Math.ceil(b.h)}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#f7f7f8"/>${edgeMarkup}${nodeMarkup}</svg>`;
}
function exportSVGFile(){downloadBlob(new Blob([projectSVG()],{type:'image/svg+xml;charset=utf-8'}),safeName(state.name)+'.svg')}
function exportPDF(){
  // Professional tiled PDF/print layout: preserve world scale and split oversized canvases
  // across multiple pages rather than shrinking the entire graph into one screenshot-like page.
  const b=exportBounds();
  const PAGE_W=1122, PAGE_H=793; // A4 landscape at ~96 CSS px/in
  const MARGIN=38, HEADER=44, FOOTER=28;
  const usableW=PAGE_W-MARGIN*2, usableH=PAGE_H-MARGIN*2-HEADER-FOOTER;
  // Keep nodes readable. Only reduce scale when the graph is exceptionally large.
  let scale=1;
  const maxPages=100;
  let cols=Math.max(1,Math.ceil(b.w/(usableW/scale))), rows=Math.max(1,Math.ceil(b.h/(usableH/scale)));
  while(cols*rows>maxPages && scale>.45){scale-=.05;cols=Math.max(1,Math.ceil(b.w/(usableW/scale)));rows=Math.max(1,Math.ceil(b.h/(usableH/scale)))}
  const tileW=usableW/scale,tileH=usableH/scale,total=cols*rows;
  const full=projectSVG();
  // Pull only the SVG's drawing markup; each page gets its own clipped viewBox.
  const inner=full.replace(/^.*?<svg[^>]*>/s,'').replace(/<\/svg>\s*$/s,'');
  let pages=''; let pageNo=0;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    pageNo++;
    const x=b.x+c*tileW,y=b.y+r*tileH;
    pages+=`<section class="pdf-page"><header><strong>${esc(state.name)}</strong><span>Canvas export</span></header><div class="sheet"><svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" viewBox="${x} ${y} ${tileW} ${tileH}" preserveAspectRatio="xMidYMid meet">${inner}</svg></div><footer><span>Infinity Nodes</span><span>Page ${pageNo} of ${total}${total>1?` · Tile ${c+1}/${cols}, ${r+1}/${rows}`:''}</span></footer></section>`;
  }
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(state.name)} — PDF</title><style>
    @page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#d9dadd;font-family:Arial,Helvetica,sans-serif;color:#202226}
    .pdf-page{width:297mm;height:210mm;background:#fff;page-break-after:always;break-after:page;padding:10mm;display:grid;grid-template-rows:11mm 1fr 7mm;overflow:hidden}
    .pdf-page:last-child{page-break-after:auto;break-after:auto}header,footer{display:flex;align-items:center;justify-content:space-between;color:#666;font-size:9pt}header strong{font-size:13pt;color:#222}header span{letter-spacing:.04em;text-transform:uppercase;font-size:7.5pt}
    .sheet{min-height:0;min-width:0;border:0.25mm solid #d8d9dd;overflow:hidden;background:#f7f7f8}.sheet svg{display:block;width:100%;height:100%}footer{border-top:.25mm solid #e4e5e8;padding-top:2mm;font-size:7.5pt}
    @media screen{body{padding:18px}.pdf-page{margin:0 auto 18px;box-shadow:0 8px 32px #0002}}
    @media print{html,body{background:#fff}.pdf-page{margin:0;box-shadow:none}}
  </style></head><body>${pages}<script>addEventListener('load',()=>setTimeout(()=>print(),250))<\/script></body></html>`;
  const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob);
  const win=window.open(url,'_blank');
  if(!win){URL.revokeObjectURL(url);alert('Your browser blocked the PDF preview. Please allow pop-ups for this local page and try again.');return}
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function exportWord(){
  const map=new Map(state.nodes.map(n=>[n.id,n]));
  const rows=state.nodes.map((n,i)=>{const links=state.edges.filter(e=>e.a===n.id||e.b===n.id).map(e=>map.get(e.a===n.id?e.b:e.a)?.text).filter(Boolean);return `<h2>${i+1}. ${esc(n.text||'Untitled node')}</h2>${n.note?.text?`<p class="note">${esc(n.note.text)}</p>`:''}<p><b>Connections:</b> ${esc(links.join(', ')||'None')}</p>`}).join('');
  const doc=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(state.name)}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#222}h1{font-size:26px}h2{font-size:17px;margin-top:24px}.note{font-style:italic;color:#555}p{line-height:1.5}</style></head><body><h1>${esc(state.name)}</h1><p>Exported from Infinity Nodes</p>${rows}</body></html>`;
  downloadBlob(new Blob(['\ufeff',doc],{type:'application/msword;charset=utf-8'}),safeName(state.name)+'.doc');
}
function exportJSON(){const payload={format:'Infinity Nodes Project',version:11,exportedAt:new Date().toISOString(),project:JSON.parse(JSON.stringify(state))};downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),safeName(state.name)+'.infinity.json')}
function interactiveHTML(){
  const data=JSON.stringify({name:state.name,nodes:state.nodes,edges:state.edges}).replace(/</g,'\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(state.name)}</title><style>*{box-sizing:border-box}html,body,#v{margin:0;width:100%;height:100%;overflow:hidden}body{font:14px system-ui;background:#17181b;color:#eee}#v{position:relative;cursor:grab;background-image:radial-gradient(#3a3c42 1px,transparent 1px);background-size:24px 24px}#w{position:absolute;transform-origin:0 0}.n{position:absolute;width:150px;min-height:76px;border:1px solid #555b66;border-radius:8px;box-shadow:0 5px 18px #0006;overflow:visible}.h{height:18px;border-radius:7px 7px 0 0}.t{padding:10px 12px;white-space:pre-wrap}.note{position:absolute;left:160px;top:28px;width:160px;padding:8px 10px;border-radius:9px;background:#fff;color:#34363b;font:italic 11px/1.4 system-ui}svg{position:absolute;left:-100000px;top:-100000px;width:200000px;height:200000px;overflow:visible;pointer-events:none}.e{stroke:#9297a1;stroke-width:2;fill:none}#tag{position:fixed;right:12px;bottom:10px;padding:6px 9px;border-radius:8px;background:#111c;color:#aaa;font-size:11px}</style></head><body><div id="v"><div id="w"><svg id="e"></svg><div id="n"></div></div></div><div id="tag">${esc(state.name)} · drag to pan · wheel to zoom</div><script>const D=${data},v=document.querySelector('#v'),w=document.querySelector('#w'),N=document.querySelector('#n'),E=document.querySelector('#e');let view={x:innerWidth/2,y:innerHeight/2,z:1},drag=null;const by=id=>D.nodes.find(n=>n.id===id),hex=h=>{h=(h||'#292b31').replace('#','');return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}},shade=(h,a)=>{let c=hex(h);return'#'+[c.r+a,c.g+a,c.b+a].map(x=>Math.max(0,Math.min(255,x)).toString(16).padStart(2,'0')).join('')},ct=h=>{let c=hex(h);return(c.r*299+c.g*587+c.b*114)/1000>150?'#17191d':'#f7f7f8'};function apply(){w.style.transform='translate('+view.x+'px,'+view.y+'px) scale('+view.z+')';v.style.backgroundPosition=view.x+'px '+view.y+'px';v.style.backgroundSize=24*view.z+'px '+24*view.z+'px'}function draw(){N.innerHTML='';D.nodes.forEach(n=>{let d=document.createElement('div'),f=n.color||'#292b31';d.className='n';d.style.left=n.x+'px';d.style.top=n.y+'px';d.style.background=f;d.style.color=ct(f);d.innerHTML='<div class="h" style="background:'+shade(f,-18)+'"></div><div class="t"></div>'+(n.note&&n.note.visible?'<div class="note"></div>':'');d.querySelector('.t').textContent=n.text||'';if(d.querySelector('.note'))d.querySelector('.note').textContent=n.note.text||'';N.append(d)});E.innerHTML='';D.edges.forEach(q=>{let a=by(q.a),b=by(q.b);if(!a||!b)return;let x1=a.x+75,y1=a.y+47,x2=b.x+75,y2=b.y+47,dx=Math.max(50,Math.abs(x2-x1)*.45),p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d','M '+(x1+100000)+' '+(y1+100000)+' C '+(x1+dx+100000)+' '+(y1+100000)+', '+(x2-dx+100000)+' '+(y2+100000)+', '+(x2+100000)+' '+(y2+100000));p.setAttribute('class','e');E.append(p)})}v.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,ox:view.x,oy:view.y};v.setPointerCapture(e.pointerId);v.style.cursor='grabbing'};v.onpointermove=e=>{if(!drag)return;view.x=drag.ox+e.clientX-drag.x;view.y=drag.oy+e.clientY-drag.y;apply()};v.onpointerup=()=>{drag=null;v.style.cursor='grab'};v.onwheel=e=>{e.preventDefault();let o=view.z,z=Math.max(.2,Math.min(3,o*Math.exp(-e.deltaY*.0015))),wx=(e.clientX-view.x)/o,wy=(e.clientY-view.y)/o;view.z=z;view.x=e.clientX-wx*z;view.y=e.clientY-wy*z;apply()};draw();apply()<\/script></body></html>`;
}
function exportInteractive(){downloadBlob(new Blob([interactiveHTML()],{type:'text/html;charset=utf-8'}),safeName(state.name)+'-interactive.html')}
function closeExportMenu(){exportMenu.hidden=true;exportMenu.classList.remove('open');exportBtn.setAttribute('aria-expanded','false')}
function openExportMenu(){exportMenu.hidden=false;exportMenu.classList.add('open');exportBtn.setAttribute('aria-expanded','true')}
exportBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();exportMenu.hidden?openExportMenu():closeExportMenu()});
exportMenu.addEventListener('click',e=>{const b=e.target.closest('button[data-export]');if(!b)return;e.preventDefault();e.stopPropagation();const action={pdf:exportPDF,word:exportWord,interactive:exportInteractive,svg:exportSVGFile,json:exportJSON}[b.dataset.export];closeExportMenu();try{action?.()}catch(err){console.error('Export failed:',err);alert('Export failed. Please try again or choose another export format.')}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#exportWrap'))closeExportMenu()});
closeExportMenu();


// V12 — expressive connections
const edgePanel=$('#edgePanel'),edgeLabel=$('#edgeLabel'),edgeColor=$('#edgeColor'),edgeStyles=$('#edgeStyles'),edgeDirections=$('#edgeDirections'),edgeWeights=$('#edgeWeights'),closeEdgePanel=$('#closeEdgePanel'),edgePanelDragHandle=$('#edgePanelDragHandle');
function edgeById(id){return state.edges.find(e=>e.id===id)}
function normaliseEdge(e){if(!e.style)e.style='solid';if(!e.direction)e.direction='none';if(!e.color)e.color='#9297a1';if(!Number.isFinite(Number(e.weight)))e.weight=2.5;if(typeof e.label!=='string')e.label='';return e}
function edgeDash(e){return e.style==='dashed'?'10 7':e.style==='dotted'?'2 7':''}
function syncEdgePanel(e){normaliseEdge(e);edgeLabel.value=e.label;edgeColor.value=e.color;edgeStyles.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.style===e.style));edgeDirections.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.direction===e.direction));edgeWeights.querySelectorAll('button').forEach(b=>b.classList.toggle('active',Number(b.dataset.weight)===Number(e.weight)))}
function openEdgePanel(e){colorPanel.hidden=true;syncEdgePanel(e);edgePanel.hidden=false}
function closeInspectors(){colorPanel.hidden=true;edgePanel.hidden=true}
function svgEl(tag,attrs={}){let x=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))x.setAttribute(k,v);return x}
function nodeBox(n){let el=document.querySelector(`[data-id="${n.id}"]`);return{cx:n.x+(el?.offsetWidth||150)/2,cy:n.y+(el?.offsetHeight||76)/2,w:el?.offsetWidth||150,h:el?.offsetHeight||76}}
function edgeAnchor(box,toward){let vx=toward.cx-box.cx,vy=toward.cy-box.cy;if(Math.abs(vx)<.001&&Math.abs(vy)<.001)return{x:box.cx,y:box.cy};let hw=box.w/2,hh=box.h/2,t=Math.min(Math.abs(vx)>.001?hw/Math.abs(vx):Infinity,Math.abs(vy)>.001?hh/Math.abs(vy):Infinity);return{x:box.cx+vx*t,y:box.cy+vy*t}}
function edgeGeometry(e){let a=nodeById(e.a),b=nodeById(e.b);if(!a||!b)return null;let ab=nodeBox(a),bb=nodeBox(b),p=edgeAnchor(ab,bb),q=edgeAnchor(bb,ab),span=Math.abs(q.x-p.x),bend=Math.max(36,span*.42),dir=q.x>=p.x?1:-1,x1=p.x+100000,y1=p.y+100000,x2=q.x+100000,y2=q.y+100000,c1x=x1+bend*dir,c2x=x2-bend*dir;return{p,q,dx:bend,d:`M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`,mx:(p.x+q.x)/2+100000,my:(p.y+q.y)/2+100000}}
function drawEdges(){edgesEl.replaceChildren();let defs=svgEl('defs');edgesEl.append(defs);for(const raw of state.edges){let e=normaliseEdge(raw),g=edgeGeometry(e);if(!g)continue;let markerId='arrow-'+e.id.replace(/[^a-zA-Z0-9_-]/g,'');let marker=svgEl('marker',{id:markerId,viewBox:'0 0 10 10',refX:'8.2',refY:'5',markerWidth:'7',markerHeight:'7',orient:'auto-start-reverse',markerUnits:'strokeWidth'});marker.append(svgEl('path',{d:'M 1 1 L 9 5 L 1 9 z',fill:e.color}));defs.append(marker);let group=svgEl('g');let path=svgEl('path',{d:g.d,class:'edge'+(selected?.type==='edge'&&selected.id===e.id?' selected':'')});path.style.stroke=e.color;path.style.strokeWidth=e.weight;path.style.strokeDasharray=edgeDash(e);if(e.direction==='forward'||e.direction==='both')path.setAttribute('marker-end',`url(#${markerId})`);if(e.direction==='backward'||e.direction==='both')path.setAttribute('marker-start',`url(#${markerId})`);let hit=svgEl('path',{d:g.d,class:'edge-hit'});hit.onpointerdown=ev=>{ev.preventDefault();ev.stopPropagation();selected={type:'edge',id:e.id};render();openEdgePanel(e)};group.append(path,hit);if(e.label.trim()){let text=svgEl('text',{x:g.mx,y:g.my-8,'text-anchor':'middle',class:'edge-label'});text.textContent=e.label;group.append(text)}edgesEl.append(group)}if(connect){let a=nodeById(connect.from);if(a){let p=center(a),q=screenToWorld(connect.x,connect.y),path=svgEl('path',{d:`M ${p.x+100000} ${p.y+100000} C ${p.x+80+100000} ${p.y+100000}, ${q.x-80+100000} ${q.y+100000}, ${q.x+100000} ${q.y+100000}`,class:'edge'});edgesEl.append(path)}}}
edgeLabel.oninput=()=>{if(selected?.type!=='edge')return;let e=edgeById(selected.id);if(!e)return;e.label=edgeLabel.value;save();drawEdges()};edgeColor.oninput=()=>{if(selected?.type!=='edge')return;let e=edgeById(selected.id);if(!e)return;e.color=edgeColor.value;save();drawEdges()};
edgeStyles.onclick=ev=>{let b=ev.target.closest('button[data-style]');if(!b||selected?.type!=='edge')return;let e=edgeById(selected.id);e.style=b.dataset.style;save();syncEdgePanel(e);drawEdges()};edgeDirections.onclick=ev=>{let b=ev.target.closest('button[data-direction]');if(!b||selected?.type!=='edge')return;let e=edgeById(selected.id);e.direction=b.dataset.direction;save();syncEdgePanel(e);drawEdges()};edgeWeights.onclick=ev=>{let b=ev.target.closest('button[data-weight]');if(!b||selected?.type!=='edge')return;let e=edgeById(selected.id);e.weight=Number(b.dataset.weight);save();syncEdgePanel(e);drawEdges()};closeEdgePanel.onclick=()=>edgePanel.hidden=true;
const deleteEdgeBtn=$('#deleteEdgeBtn');
deleteEdgeBtn.onclick=()=>{
  if(selected?.type!=='edge')return;
  const id=selected.id;
  if(!state.edges.some(e=>e.id===id))return;
  checkpoint();
  state.edges=state.edges.filter(e=>e.id!==id);
  selected=null;
  edgePanel.hidden=true;
  save();
  render();
};
let edgePanelDrag=null;edgePanelDragHandle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();let r=edgePanel.getBoundingClientRect();edgePanel.style.right='auto';edgePanelDrag={sx:e.clientX,sy:e.clientY,x:r.left,y:r.top};edgePanel.classList.add('edge-panel-dragging');edgePanelDragHandle.setPointerCapture?.(e.pointerId)};edgePanelDragHandle.onpointermove=e=>{if(!edgePanelDrag)return;let x=Math.max(4,Math.min(innerWidth-edgePanel.offsetWidth-4,edgePanelDrag.x+e.clientX-edgePanelDrag.sx)),y=Math.max(4,Math.min(innerHeight-edgePanel.offsetHeight-4,edgePanelDrag.y+e.clientY-edgePanelDrag.sy));edgePanel.style.left=x+'px';edgePanel.style.top=y+'px'};edgePanelDragHandle.onpointerup=()=>{if(!edgePanelDrag)return;let r=edgePanel.getBoundingClientRect();localStorage.setItem('infinity-nodes-edge-inspector-position',JSON.stringify({x:r.left,y:r.top}));edgePanelDrag=null;edgePanel.classList.remove('edge-panel-dragging')};
try{let p=JSON.parse(localStorage.getItem('infinity-nodes-edge-inspector-position'));if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){edgePanel.style.left=p.x+'px';edgePanel.style.top=p.y+'px';edgePanel.style.right='auto'}}catch{}
// Ensure old projects gain V12 defaults without breaking storage compatibility.
const framePanel=$('#framePanel'),frameTitle=$('#frameTitle'),frameFill=$('#frameFill'),frameOpacity=$('#frameOpacity'),frameLine=$('#frameLine'),frameLineStyle=$('#frameLineStyle'),frameLineWidth=$('#frameLineWidth'),frameTarget=$('#frameTarget');
let frameDraw=null;
function normaliseFrame(f){if(f.portalProjectId!==null&&typeof f.portalProjectId!=='string')f.portalProjectId=null;f.title=f.title||'Frame';f.fill=f.fill||'#5d6b82';f.opacity=Number.isFinite(f.opacity)?f.opacity:.18;f.line=f.line||'#8794aa';f.lineStyle=f.lineStyle||'solid';f.lineWidth=Number(f.lineWidth)||2;if(!['none','canvas'].includes(f.pinMode))f.pinMode='none';if(!Array.isArray(f.points)||f.points.length<3){let w=Number(f.w)||420,h=Number(f.h)||280;f.points=[{x:f.x,y:f.y},{x:f.x+w,y:f.y},{x:f.x+w,y:f.y+h},{x:f.x,y:f.y+h}]}return f}
function frameById(id){return (state.frames||[]).find(f=>f.id===id)}
function frameBounds(f){normaliseFrame(f);let xs=f.points.map(p=>p.x),ys=f.points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),maxX:Math.max(...xs),maxY:Math.max(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}
function dashArray(f){return f.lineStyle==='dashed'?'10 7':f.lineStyle==='dotted'?'2 7':''}
function renderFramesNow(){state.frames=state.frames||[];framesEl.replaceChildren();for(const f0 of state.frames){const f=normaliseFrame(f0),b=frameBounds(f),wrap=document.createElement('div');wrap.className='frame-shape'+((selected?.type==='frame'&&selected.id===f.id)||isMulti('frame',f.id)?' selected':'');wrap.dataset.frameId=f.id;wrap.dataset.pinned=f.pinMode||'none';wrap.style.left=(b.x+100000)+'px';wrap.style.top=(b.y+100000)+'px';wrap.style.width=Math.max(1,b.w)+'px';wrap.style.height=Math.max(1,b.h)+'px';let svg=svgEl('svg',{viewBox:`0 0 ${Math.max(1,b.w)} ${Math.max(1,b.h)}`});svg.classList.add('frame-svg');let pts=f.points.map(p=>`${p.x-b.x},${p.y-b.y}`).join(' ');let poly=svgEl('polygon',{points:pts,fill:hexAlpha(f.fill,f.opacity),stroke:f.line,'stroke-width':f.lineWidth,'stroke-linejoin':'round'});let da=dashArray(f);if(da)poly.setAttribute('stroke-dasharray',da);poly.onpointerdown=e=>{if(e.button!==0)return;e.stopPropagation();if(e.shiftKey){toggleMulti('frame',f.id);return}clearMulti();selected={type:'frame',id:f.id};openFramePanel(f);renderFrames()};svg.append(poly);wrap.append(svg);let t=document.createElement('div');t.className='frame-title shape-title';t.textContent=f.title;t.onpointerdown=e=>startFrameDrag(e,f);wrap.append(t);if(f.portalProjectId){let pb=document.createElement('button');pb.className='frame-portal-badge';pb.type='button';pb.title='Open linked project';pb.innerHTML='<svg viewBox="0 0 24 24"><path d="M9 7h8v8M17 7 8 16"/></svg>';pb.onclick=e=>{e.stopPropagation();openPortal(f.portalProjectId)};wrap.append(pb)}if(selected?.type==='frame'&&selected.id===f.id){f.points.forEach((p,i)=>{let h=document.createElement('button');h.className='frame-vertex';h.title='Drag to reshape';h.style.left=(p.x-b.x)+'px';h.style.top=(p.y-b.y)+'px';h.onpointerdown=e=>startFrameVertex(e,f,i);wrap.append(h)})}framesEl.append(wrap)}renderFrameDraft()}
let frameRenderPending=false, frameRenderLast=0;
function renderFrames(){
  if(frameRenderPending)return;
  frameRenderPending=true;
  const run=()=>{frameRenderPending=false;frameRenderLast=performance.now();renderFramesNow()};
  const wait=Math.max(0,24-(performance.now()-frameRenderLast));
  if(wait>1)setTimeout(()=>requestAnimationFrame(run),wait);else requestAnimationFrame(run);
}
function renderFrameDraft(){document.querySelector('.frame-draft')?.remove();if(!frameDraw||!frameDraw.points.length)return;let pts=frameDraw.points,b={x:Math.min(...pts.map(p=>p.x)),y:Math.min(...pts.map(p=>p.y))},el=document.createElement('div');el.className='frame-draft';el.style.left=(b.x+100000)+'px';el.style.top=(b.y+100000)+'px';let svg=svgEl('svg');svg.style.overflow='visible';let poly=svgEl('polyline',{points:pts.map(p=>`${p.x-b.x},${p.y-b.y}`).join(' '),fill:'none',stroke:'#8794aa','stroke-width':'2','stroke-dasharray':'7 6'});svg.append(poly);el.append(svg);framesEl.append(el)}
function hexAlpha(hex,a){let c=hexToRgb(hex);return `rgba(${c.r},${c.g},${c.b},${Math.max(0,Math.min(1,a))})`}
function addFrame(){frameDraw={points:[]};selected=null;framePanel.hidden=true;document.body.classList.add('drawing-frame');$('#addFrameBtn').textContent='Finish frame';$('#addFrameBtn').title='Click canvas points, then click Finish frame'}
function finishFrameDraw(){if(!frameDraw)return;if(frameDraw.points.length>=3){checkpoint();let f={id:uid(),points:frameDraw.points.map(p=>({...p})),title:'New frame',fill:'#5d6b82',opacity:.18,line:'#8794aa',lineStyle:'solid',lineWidth:2};state.frames=state.frames||[];state.frames.push(f);selected={type:'frame',id:f.id};save();openFramePanel(f)}frameDraw=null;document.body.classList.remove('drawing-frame');$('#addFrameBtn').textContent='Frame';$('#addFrameBtn').title='Draw frame';render()}
function startFrameDrag(e,f){if(e.button!==0)return;if(e.shiftKey){e.preventDefault();e.stopPropagation();toggleMulti('frame',f.id);return}if(beginGroupDrag(e,'frame',f.id))return;clearMulti();if(f.pinMode==='canvas'){selected={type:'frame',id:f.id};openFramePanel(f);renderFrames();return}e.preventDefault();e.stopPropagation();dragStartSnapshot=projectSnapshot();selected={type:'frame',id:f.id};drag={type:'frame',id:f.id,sx:e.clientX,sy:e.clientY,points:f.points.map(p=>({...p}))};drag.ox=0;drag.oy=0}
function startFrameVertex(e,f,index){if(e.button!==0)return;if(f.pinMode==='canvas')return;e.preventDefault();e.stopPropagation();dragStartSnapshot=projectSnapshot();selected={type:'frame',id:f.id};let p=f.points[index];drag={type:'frame-vertex',id:f.id,index,sx:e.clientX,sy:e.clientY,opx:p.x,opy:p.y}}
function openFramePanel(f){normaliseFrame(f);syncFramePortalPanel(f);frameTitle.value=f.title;frameFill.value=f.fill;frameOpacity.value=Math.round(f.opacity*100);frameLine.value=f.line;frameLineStyle.value=f.lineStyle;frameLineWidth.value=f.lineWidth;framePinMode.value=f.pinMode||'none';frameTarget.replaceChildren();let opt=document.createElement('option');opt.value='__new__';opt.textContent='New project…';frameTarget.append(opt);for(const p of db.projects.filter(p=>p.id!==state.id)){let o=document.createElement('option');o.value=p.id;o.textContent=p.name||'Untitled Project';frameTarget.append(o)}framePanel.hidden=false}
let frameSaveTimer=null;
function saveFrameEditSoon(){clearTimeout(frameSaveTimer);frameSaveTimer=setTimeout(()=>{frameSaveTimer=null;save()},120)}
function updateFrame(prop,val){if(selected?.type!=='frame')return;let f=frameById(selected.id);if(!f)return;f[prop]=val;saveFrameEditSoon();renderFrames()}
frameTitle.oninput=()=>updateFrame('title',frameTitle.value);frameFill.oninput=()=>updateFrame('fill',frameFill.value);frameOpacity.oninput=()=>updateFrame('opacity',Number(frameOpacity.value)/100);frameLine.oninput=()=>updateFrame('line',frameLine.value);frameLineStyle.onchange=()=>updateFrame('lineStyle',frameLineStyle.value);frameLineWidth.oninput=()=>updateFrame('lineWidth',Number(frameLineWidth.value));
function pointInPolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){let a=points[i],b=points[j],hit=((a.y>y)!=(b.y>y))&&(x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x);if(hit)inside=!inside}return inside}
function nodesInsideFrame(f){return state.nodes.filter(n=>{let el=document.querySelector(`[data-id="${n.id}"]`),w=el?.offsetWidth||150,h=el?.offsetHeight||40;return pointInPolygon(n.x+w/2,n.y+h/2,f.points)})}
function copyFrame(){let f=frameById(selected?.id);if(!f)return;let b=frameBounds(f),inside=nodesInsideFrame(f),ids=new Set(inside.map(n=>n.id)),map=new Map(),copies=inside.map(n=>{let x=structuredClone(n);let old=x.id;x.id=uid();map.set(old,x.id);x.x-=b.x;x.y-=b.y;if(x.pinMode==='frame'&&x.pinFrameId===f.id)x.pinFrameId='__COPIED_FRAME__';return x}),edges=state.edges.filter(e=>ids.has(e.a)&&ids.has(e.b)).map(e=>{let x=structuredClone(e);x.id=uid();x.a=map.get(e.a);x.b=map.get(e.b);return x}),fc=structuredClone(f);fc.id=uid();for(const x of copies){if(x.pinFrameId==='__COPIED_FRAME__')x.pinFrameId=fc.id;if(x.portalNodeId)x.portalNodeId=map.get(x.portalNodeId)||null;}fc.points=fc.points.map(p=>({x:p.x-b.x,y:p.y-b.y}));let target;if(frameTarget.value==='__new__'){target=freshProject(f.title||'Frame');db.projects.push(target)}else target=db.projects.find(p=>p.id===frameTarget.value);if(!target)return;target.frames=target.frames||[];target.frames.push(fc);target.nodes.push(...copies);target.edges.push(...edges);target.updated=Date.now();save();renderProjects();alert(`Copied “${f.title}” with ${copies.length} node${copies.length===1?'':'s'} to ${target.name}.`)}
$('#copyFrameBtn').onclick=copyFrame;$('#addFrameBtn').onclick=()=>frameDraw?finishFrameDraw():addFrame();$('#closeFramePanel').onclick=()=>framePanel.hidden=true;$('#deleteFrameBtn').onclick=()=>{if(selected?.type!=='frame')return;checkpoint();state.frames=state.frames.filter(f=>f.id!==selected.id);selected=null;framePanel.hidden=true;save();render()};
for(const p of db.projects){p.frames=p.frames||[];for(const f of p.frames)normaliseFrame(f)}


addEventListener('pagehide',()=>{if(frameSaveTimer){clearTimeout(frameSaveTimer);frameSaveTimer=null;save()}});

// Initialize only after every V15 frame/edge module has been declared.

/* V17 — Project Portals */
const nodePortalProject=$('#nodePortalProject'),openNodePortal=$('#openNodePortal'),framePortalProject=$('#framePortalProject'),openFramePortal=$('#openFramePortal');
function portalTargets(select,currentId){
  select.replaceChildren();let none=document.createElement('option');none.value='';none.textContent='No portal';select.append(none);
  for(const p of db.projects.filter(p=>p.id!==state.id)){let o=document.createElement('option');o.value=p.id;o.textContent=p.name||'Untitled Project';select.append(o)}
  select.value=db.projects.some(p=>p.id===currentId&&p.id!==state.id)?currentId:'';
}
// V25 — same-project node destinations; legacy project IDs remain unchanged.
function syncNodePortalPanel(n){
  if(!nodePortalProject)return;normaliseNode(n);
  nodePortalProject.replaceChildren();
  const add=(parent,value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;parent.append(o);return o};
  add(nodePortalProject,'','No portal');
  const group=document.createElement('optgroup');group.label='This project';
  for(const target of state.nodes){if(target.id!==n.id)add(group,JSON.stringify(['node',target.id]),target.text||'Untitled node')}
  if(n.portalNodeId&&!nodeById(n.portalNodeId)){const missing=add(group,JSON.stringify(['node',n.portalNodeId]),'Linked node is no longer available');missing.disabled=true}
  if(group.children.length)nodePortalProject.append(group);
  const projects=document.createElement('optgroup');projects.label='Other projects';
  for(const p of db.projects){if(p.id!==state.id)add(projects,JSON.stringify(['project',p.id]),p.name||'Untitled Project')}
  if(projects.children.length)nodePortalProject.append(projects);
  nodePortalProject.value=n.portalNodeId?JSON.stringify(['node',n.portalNodeId]):db.projects.some(p=>p.id===n.portalProjectId&&p.id!==state.id)?JSON.stringify(['project',n.portalProjectId]):'';
  openNodePortal.hidden=!nodePortalProject.value;
  openNodePortal.textContent=n.portalNodeId?'Focus linked node':'Open linked project';
}
function openNodeDestination(n){
  normaliseNode(n);
  if(n.portalNodeId){
    if(!nodeById(n.portalNodeId)){alert('That linked node is no longer available in this project.');return}
    clearMulti();closeInspectors();framePanel.hidden=true;focusNode(n.portalNodeId);
  }else if(n.portalProjectId)openPortal(n.portalProjectId);
}
function syncFramePortalPanel(f){if(!framePortalProject)return;portalTargets(framePortalProject,f.portalProjectId);openFramePortal.hidden=!framePortalProject.value}
function openPortal(projectId){let p=db.projects.find(x=>x.id===projectId);if(!p){alert('That linked project is no longer available.');return}switchProject(projectId)}
nodePortalProject.onchange=()=>{
  if(selected?.type!=='node')return;const n=nodeById(selected.id);if(!n)return;
  let kind=null,id=null;
  if(nodePortalProject.value){
    try{[kind,id]=JSON.parse(nodePortalProject.value)}catch{syncNodePortalPanel(n);return}
    if(!((kind==='node'&&id!==n.id&&nodeById(id))||(kind==='project'&&db.projects.some(p=>p.id===id&&p.id!==state.id)))){syncNodePortalPanel(n);return}
  }
  checkpoint();n.portalNodeId=kind==='node'?id:null;n.portalProjectId=kind==='project'?id:null;
  save();render();colorPanel.hidden=false;syncNodePortalPanel(n);
};
openNodePortal.onclick=()=>{let n=selected?.type==='node'&&nodeById(selected.id);if(n)openNodeDestination(n)};
framePortalProject.onchange=()=>{if(selected?.type!=='frame')return;let f=frameById(selected.id);if(!f)return;checkpoint();f.portalProjectId=framePortalProject.value||null;openFramePortal.hidden=!f.portalProjectId;save();renderFrames();framePanel.hidden=false;syncFramePortalPanel(f)};
openFramePortal.onclick=()=>{let f=selected?.type==='frame'&&frameById(selected.id);if(f?.portalProjectId)openPortal(f.portalProjectId)};

// V19 SAFE IMAGES — intentionally isolated from core startup.
const addImageBtn=$('#addImageBtn'),imageFileInput=$('#imageFileInput'),
      attachImageBtn=$('#attachImageBtn'),replaceImageBtn=$('#replaceImageBtn'),
      removeImageBtn=$('#removeImageBtn'),imageEditorWrap=$('#imageEditorWrap');
let imageAttachTarget=null;

function readImageFile(file,cb){
  if(!file||!file.type.startsWith('image/'))return;
  const r=new FileReader();
  r.onload=()=>cb(String(r.result||''));
  r.readAsDataURL(file);
}
function imageNodeAt(data,x,y,name){
  checkpoint();
  const n={id:uid(),x,y,text:(name||'Image').replace(/\.[^.]+$/,''),color:'#5d6b82',opacity:1,
    note:null,type:'standard',pinMode:'none',pinFrameId:null,portalProjectId:null,imageData:data};
  state.nodes.push(n);selected={type:'node',id:n.id};save();render();openColor(n);
}
function chooseImageFor(target){
  imageAttachTarget=target;imageFileInput.value='';imageFileInput.click();
}
if(addImageBtn)addImageBtn.onclick=()=>chooseImageFor({kind:'new'});
if(attachImageBtn)attachImageBtn.onclick=()=>{if(selected?.type==='node')chooseImageFor({kind:'node',id:selected.id})};
if(replaceImageBtn)replaceImageBtn.onclick=()=>{if(selected?.type==='node')chooseImageFor({kind:'node',id:selected.id})};
if(removeImageBtn)removeImageBtn.onclick=()=>{if(selected?.type!=='node')return;const n=nodeById(selected.id);if(!n)return;checkpoint();delete n.imageData;save();render();openColor(n)};
if(imageFileInput)imageFileInput.onchange=()=>{
  const file=imageFileInput.files&&imageFileInput.files[0],target=imageAttachTarget;imageAttachTarget=null;
  readImageFile(file,data=>{
    if(!data)return;
    if(target?.kind==='node'){
      const n=nodeById(target.id);if(!n)return;checkpoint();n.imageData=data;save();render();selected={type:'node',id:n.id};openColor(n);
    }else{
      const rect=viewport.getBoundingClientRect(),p=screenToWorld(rect.left+rect.width/2,rect.top+rect.height/2);
      imageNodeAt(data,p.x-110,p.y-80,file.name);
    }
  });
};
viewport.addEventListener('dragover',e=>{if([...(e.dataTransfer?.items||[])].some(i=>i.type.startsWith('image/')))e.preventDefault()});
viewport.addEventListener('drop',e=>{
  const file=[...(e.dataTransfer?.files||[])].find(f=>f.type.startsWith('image/'));if(!file)return;
  e.preventDefault();const p=screenToWorld(e.clientX,e.clientY);
  readImageFile(file,data=>imageNodeAt(data,p.x-110,p.y-80,file.name));
});


// V21 Background customization — per project. Fixed theme defaults + zoom-aware patterns.
const backgroundBtn=$('#backgroundBtn'),backgroundPanel=$('#backgroundPanel'),backgroundClose=$('#backgroundClose'),
backgroundColor=$('#backgroundColor'),backgroundReset=$('#backgroundReset'),backgroundPanelHead=$('#backgroundPanelHead');
function defaultBg(){return db.theme==='light'?'#f3f4f6':'#17181b'}
function bg(){
 if(!state.background)state.background={style:'dots',color:null,customColor:false};
 if(!state.background.style)state.background.style='dots';
 // Migrate V21's hard-coded defaults so theme switching works again.
 if(state.background.customColor==null){
   const c=(state.background.color||'').toLowerCase();
   state.background.customColor=!!c&&!['#101114','#f7f7f8','#17181b','#f3f4f6'].includes(c);
 }
 return state.background;
}
function effectiveBg(){const b=bg();return b.customColor&&b.color?b.color:defaultBg()}
function applyBackground(){
 const b=bg(),color=effectiveBg(),h=color.replace('#',''),v=parseInt(h,16),r=(v>>16)&255,g=(v>>8)&255,bl=v&255,lum=(r*299+g*587+bl*114)/1000;
 const z=state.view?.zoom||1,x=state.view?.x||0,y=state.view?.y||0;
 viewport.classList.remove('bg-dots','bg-blank','bg-stripes','bg-squared','bg-notebook');
 viewport.classList.add('custom-bg','bg-'+b.style);
 viewport.style.setProperty('--canvas-bg',color);
 viewport.style.setProperty('--grid-ink',lum>145?'rgba(20,25,35,.17)':'rgba(235,240,255,.17)');
 viewport.style.setProperty('--bg-x',x+'px');viewport.style.setProperty('--bg-y',y+'px');
 // Pattern scale follows canvas zoom, just like the original dot grid did.
 viewport.style.setProperty('--dot-size',(24*z)+'px');
 viewport.style.setProperty('--stripe-size',(18*z)+'px');
 viewport.style.setProperty('--square-size',(28*z)+'px');
 viewport.style.setProperty('--notebook-size',(28*z)+'px');
 viewport.style.setProperty('--notebook-line',(27*z)+'px');
 if(backgroundColor)backgroundColor.value=color;
 document.querySelectorAll('[data-bg-style]').forEach(x=>x.classList.toggle('active',x.dataset.bgStyle===b.style));
}
backgroundBtn.onclick=e=>{e.stopPropagation();backgroundPanel.hidden=!backgroundPanel.hidden;applyBackground()};
backgroundClose.onclick=()=>backgroundPanel.hidden=true;
document.querySelectorAll('[data-bg-style]').forEach(x=>x.onclick=()=>{checkpoint();bg().style=x.dataset.bgStyle;save();applyBackground()});
document.querySelectorAll('[data-bg-color]').forEach(x=>x.onclick=()=>{checkpoint();let b=bg();b.color=x.dataset.bgColor;b.customColor=true;save();applyBackground()});
backgroundColor.onchange=()=>{checkpoint();let b=bg();b.color=backgroundColor.value;b.customColor=true;save();applyBackground()};
backgroundReset.onclick=()=>{checkpoint();state.background={style:'dots',color:null,customColor:false};save();applyBackground()};
if(backgroundPanelHead){let d=null;backgroundPanelHead.onpointerdown=e=>{if(e.target.closest('button'))return;let r=backgroundPanel.getBoundingClientRect();d={x:e.clientX-r.left,y:e.clientY-r.top};backgroundPanelHead.setPointerCapture(e.pointerId)};
backgroundPanelHead.onpointermove=e=>{if(!d)return;backgroundPanel.style.left=(e.clientX-d.x)+'px';backgroundPanel.style.top=(e.clientY-d.y)+'px';backgroundPanel.style.right='auto'};
backgroundPanelHead.onpointerup=()=>d=null}

applySidebar();applyTheme();renderProjects();render();updateHistoryButtons();
db.trash=db.trash||[];for(const p of db.projects){p.frames=p.frames||[];for(const n of p.nodes)normaliseNode(n);for(const e of p.edges)normaliseEdge(e)}save();render();


// V16 pinning system
function framesContainingNode(n){
  if(!n)return [];
  const el=document.querySelector(`[data-id="${n.id}"]`);
  const w=(el&&el.offsetWidth)||150,h=(el&&el.offsetHeight)||56;
  const cx=(Number(n.x)||0)+w/2,cy=(Number(n.y)||0)+h/2;
  return (state.frames||[]).filter(raw=>{
    const f=normaliseFrame(raw),pts=f&&Array.isArray(f.points)?f.points:[];
    return pts.length>=3&&pts.every(p=>Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y)))&&pointInPolygon(cx,cy,pts);
  });
}
function syncNodePinPanel(n){
  if(!n||!nodePinMode||!nodePinFrame)return;
  normaliseNode(n);
  const containing=framesContainingNode(n);
  if(n.pinMode==='frame'&&n.pinFrameId){
    const pinned=frameById(n.pinFrameId);
    if(pinned&&!containing.some(f=>f.id===pinned.id))containing.unshift(pinned);
  }
  const frameOption=Array.from(nodePinMode.options).find(o=>o.value==='frame');
  if(frameOption){
    frameOption.disabled=containing.length===0;
    frameOption.textContent=containing.length?'Pin to frame':'Pin to frame (place node on a frame first)';
  }
  if(n.pinMode==='frame'&&!containing.length){n.pinMode='none';n.pinFrameId=null;}
  nodePinMode.value=n.pinMode||'none';
  nodePinFrame.replaceChildren();
  containing.forEach(f=>{const o=document.createElement('option');o.value=f.id;o.textContent=f.title||'Frame';nodePinFrame.append(o)});
  if(n.pinMode==='frame'&&containing.length){
    if(!n.pinFrameId||!containing.some(f=>f.id===n.pinFrameId))n.pinFrameId=containing[0].id;
    nodePinFrame.value=n.pinFrameId;
  }
  nodePinFrame.hidden=!(n.pinMode==='frame'&&containing.length>1);
}
nodePinMode.onchange=()=>{
  if(selected?.type!=='node')return;
  const n=nodeById(selected.id);if(!n)return;
  const containing=framesContainingNode(n),requested=nodePinMode.value;
  checkpoint();
  if(requested==='frame'){
    if(!containing.length){n.pinMode='none';n.pinFrameId=null;}
    else{n.pinMode='frame';n.pinFrameId=containing.some(f=>f.id===nodePinFrame.value)?nodePinFrame.value:containing[0].id;}
  }else{n.pinMode=requested==='canvas'?'canvas':'none';n.pinFrameId=null;}
  save();syncNodePinPanel(n);
  const el=document.querySelector(`[data-id="${n.id}"]`);if(el)el.dataset.pinned=n.pinMode;
};
nodePinFrame.onchange=()=>{if(selected?.type!=='node')return;let n=nodeById(selected.id);n.pinFrameId=nodePinFrame.value;save()};
framePinMode.onchange=()=>{if(selected?.type!=='frame')return;let f=frameById(selected.id);checkpoint();f.pinMode=framePinMode.value;save();renderFrames()};



// V23 — Full workspace backup / restore.
const workspaceBtn=$('#workspaceBtn'),workspacePanel=$('#workspacePanel'),workspaceClose=$('#workspaceClose'),downloadWorkspaceBackup=$('#downloadWorkspaceBackup'),restoreWorkspaceBackup=$('#restoreWorkspaceBackup'),workspaceImportInput=$('#workspaceImportInput');
const RECOVERY_KEY='infinity-nodes-v23-pre-restore';
function workspacePayload(){
  const uiPreferences={};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('infinity-nodes-')&&k!==STORAGE&&k!==OLD&&k!==RECOVERY_KEY){try{uiPreferences[k]=localStorage.getItem(k)}catch{}}}
  return{format:'Infinity Nodes Workspace Backup',version:23,exportedAt:new Date().toISOString(),storageKey:STORAGE,database:JSON.parse(JSON.stringify(db)),uiPreferences};
}
function workspaceFileName(){const d=new Date(),p=n=>String(n).padStart(2,'0');return`Infinity-Nodes-Workspace-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}.infinitybackup.json`}
function downloadFullWorkspace(){save();downloadBlob(new Blob([JSON.stringify(workspacePayload(),null,2)],{type:'application/json;charset=utf-8'}),workspaceFileName())}
function validWorkspaceBackup(x){return x&&x.format==='Infinity Nodes Workspace Backup'&&x.database&&Array.isArray(x.database.projects)}
async function restoreFullWorkspace(file){
 let text,payload;try{text=await file.text();payload=JSON.parse(text)}catch{alert('That file could not be read as an Infinity Nodes backup.');return}
 if(!validWorkspaceBackup(payload)){alert('That file is not a valid Infinity Nodes V23 workspace backup.');return}
 const count=payload.database.projects.length;
 if(!confirm(`Restore this workspace backup?\n\nIt contains ${count} project${count===1?'':'s'}.\n\nYour current browser workspace will be replaced.`))return;
 try{
  localStorage.setItem(RECOVERY_KEY,JSON.stringify(workspacePayload()));
  localStorage.setItem(STORAGE,JSON.stringify(payload.database));
  if(payload.uiPreferences&&typeof payload.uiPreferences==='object')for(const[k,v]of Object.entries(payload.uiPreferences))if(k.startsWith('infinity-nodes-')&&k!==STORAGE&&k!==OLD&&k!==RECOVERY_KEY&&typeof v==='string')localStorage.setItem(k,v);
  db=payload.database;db.trash=db.trash||[];db.templates=db.templates||[];state=current();selected=null;clearMulti();resetHistory();applyTheme();renderProjects();render();workspacePanel.hidden=true;
  alert(`Workspace restored successfully. ${count} project${count===1?'':'s'} loaded.`);
 }catch(err){console.error(err);alert('Restore failed. Your previous workspace recovery copy was kept in this browser.')}
}
workspaceBtn.onclick=e=>{e.stopPropagation();workspacePanel.hidden=!workspacePanel.hidden};
workspaceClose.onclick=()=>workspacePanel.hidden=true;workspacePanel.onpointerdown=e=>e.stopPropagation();
downloadWorkspaceBackup.onclick=downloadFullWorkspace;restoreWorkspaceBackup.onclick=()=>workspaceImportInput.click();
workspaceImportInput.onchange=async()=>{const f=workspaceImportInput.files?.[0];workspaceImportInput.value='';if(f)await restoreFullWorkspace(f)};


// V24 — two-finger pinch zoom.
const v24TouchCanvas=document.querySelector('#canvas');
if(v24TouchCanvas){
 let v24Pinch=null;
 const v24Dist=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
 const v24Mid=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});
 v24TouchCanvas.addEventListener('touchstart',e=>{
  if(e.touches.length===2){v24Pinch={distance:v24Dist(e.touches[0],e.touches[1]),zoom:state.view.zoom};e.preventDefault();}
 },{passive:false});
 v24TouchCanvas.addEventListener('touchmove',e=>{
  if(e.touches.length===2&&v24Pinch){
   e.preventDefault();const m=v24Mid(e.touches[0],e.touches[1]),r=v24TouchCanvas.getBoundingClientRect(),oldZ=state.view.zoom;
   const newZ=Math.max(.2,Math.min(3,v24Pinch.zoom*(v24Dist(e.touches[0],e.touches[1])/Math.max(1,v24Pinch.distance))));
   const sx=m.x-r.left,sy=m.y-r.top,wx=(sx-state.view.x)/oldZ,wy=(sy-state.view.y)/oldZ;
   state.view.zoom=newZ;state.view.x=sx-wx*newZ;state.view.y=sy-wy*newZ;applyView();
  }
 },{passive:false});
 v24TouchCanvas.addEventListener('touchend',e=>{if(e.touches.length<2&&v24Pinch){v24Pinch=null;save();}},{passive:false});
 v24TouchCanvas.addEventListener('touchcancel',()=>{v24Pinch=null},{passive:true});
}

// V20 — Templates. Kept isolated from the core graph system.
{
  db.templates=db.templates||[];
  const panel=$('#templatesPanel'), list=$('#templatesList'), openBtn=$('#templatesBtn'), closeBtn=$('#closeTemplates'), saveProjectBtn=$('#saveProjectTemplateBtn'), saveFrameBtn=$('#saveFrameTemplateBtn');
  const clone=x=>JSON.parse(JSON.stringify(x));
  function askName(fallback){let x=prompt('Template name',fallback||'Template');return x&&x.trim()?x.trim():null}
  function stripPortal(x){if(x&&'portalProjectId' in x)x.portalProjectId=null;if(x&&'portalNodeId' in x)x.portalNodeId=null;return x}
  function framePayload(f){
    let b=frameBounds(f), inside=nodesInsideFrame(f), ids=new Set(inside.map(n=>n.id));
    return {frame:clone(f),nodes:clone(inside),edges:clone(state.edges.filter(e=>ids.has(e.a)&&ids.has(e.b))),origin:{x:b.x,y:b.y}};
  }
  function saveProjectTemplate(){let name=askName(state.name||'Project');if(!name)return;db.templates.push({id:uid(),name,kind:'project',created:Date.now(),data:{nodes:clone(state.nodes),edges:clone(state.edges),frames:clone(state.frames||[]),view:clone(state.view)}});save();renderTemplates();}
  function saveFrameTemplate(){let f=selected?.type==='frame'&&frameById(selected.id);if(!f){alert('Select a frame first.');return}let name=askName(f.title||'Frame');if(!name)return;db.templates.push({id:uid(),name,kind:'frame',created:Date.now(),data:framePayload(f)});save();renderTemplates();}
  function remapGraph(data,offset={x:0,y:0}){
    const nmap=new Map(), fmap=new Map();
    let frames=(data.frames||[]).map(f=>{let c=stripPortal(clone(f)),old=c.id;c.id=uid();fmap.set(old,c.id);c.points=(c.points||[]).map(p=>({x:p.x+offset.x,y:p.y+offset.y}));return c});
    let nodes=(data.nodes||[]).map(n=>{let c=stripPortal(clone(n)),old=c.id;c.id=uid();nmap.set(old,c.id);c.x+=offset.x;c.y+=offset.y;return c});
    for(const n of nodes)if(n.pinMode==='frame')n.pinFrameId=fmap.get(n.pinFrameId)||null;
    let edges=(data.edges||[]).filter(e=>nmap.has(e.a)&&nmap.has(e.b)).map(e=>{let c=clone(e);c.id=uid();c.a=nmap.get(e.a);c.b=nmap.get(e.b);return c});
    return {nodes,frames,edges};
  }
  function useTemplate(t){
    if(t.kind==='project'){
      let name=t.name, p=freshProject(name), g=remapGraph(t.data);p.nodes=g.nodes;p.frames=g.frames;p.edges=g.edges;p.view={x:innerWidth/2,y:innerHeight/2,zoom:1};db.projects.push(p);db.activeId=p.id;state=p;selected=null;clearMulti();resetHistory();save();renderProjects();render();panel.hidden=true;
    }else{
      let d=t.data, rect=viewport.getBoundingClientRect(), center=screenToWorld(rect.left+rect.width/2,rect.top+rect.height/2), f=d.frame, b=frameBounds(f), ox=center.x-(b.x+b.w/2), oy=center.y-(b.y+b.h/2), g=remapGraph({frames:[f],nodes:d.nodes,edges:d.edges},{x:ox,y:oy});checkpoint();state.frames=state.frames||[];state.frames.push(...g.frames);state.nodes.push(...g.nodes);state.edges.push(...g.edges);save();render();panel.hidden=true;
    }
  }
  function deleteTemplate(id){let t=db.templates.find(x=>x.id===id);if(!t)return;if(!confirm(`Delete template “${t.name}”?`))return;db.templates=db.templates.filter(x=>x.id!==id);save();renderTemplates()}
  function renderTemplates(){
    list.replaceChildren();
    if(!db.templates.length){let e=document.createElement('div');e.className='search-empty';e.textContent='No templates yet';list.append(e);return}
    for(const t of [...db.templates].sort((a,b)=>(b.created||0)-(a.created||0))){let row=document.createElement('div');row.className='template-row';let use=document.createElement('button');use.className='template-use';use.innerHTML=`<span class="template-name"></span><span class="template-kind">${t.kind==='project'?'Project template':'Frame template'}</span>`;use.querySelector('.template-name').textContent=t.name;use.onclick=()=>useTemplate(t);let del=document.createElement('button');del.className='template-delete';del.title='Delete template';del.textContent='×';del.onclick=e=>{e.stopPropagation();deleteTemplate(t.id)};row.append(use,del);list.append(row)}
  }
  openBtn.onclick=e=>{e.stopPropagation();renderTemplates();panel.hidden=!panel.hidden};closeBtn.onclick=()=>panel.hidden=true;saveProjectBtn.onclick=saveProjectTemplate;if(saveFrameBtn)saveFrameBtn.onclick=saveFrameTemplate;
  panel.onpointerdown=e=>e.stopPropagation();
  save();

}

})();

/* V15 frame inspector: movable like Node/Connection inspectors */
(()=>{
  const panel=document.querySelector('#framePanel');
  const handle=document.querySelector('#framePanelDragHandle');
  if(!panel||!handle)return;
  const key='infinity-nodes-frame-inspector-position';
  const clamp=(x,y)=>({
    x:Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,x)),
    y:Math.max(4,Math.min(innerHeight-panel.offsetHeight-4,y))
  });
  try{
    const p=JSON.parse(localStorage.getItem(key)||'null');
    if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){
      const q=clamp(p.x,p.y);panel.style.left=q.x+'px';panel.style.top=q.y+'px';panel.style.right='auto';
    }
  }catch{}
  let drag=null;
  handle.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    if(e.target.closest('button,input,select,textarea'))return;
    e.preventDefault();e.stopPropagation();
    const r=panel.getBoundingClientRect();
    panel.style.right='auto';
    drag={sx:e.clientX,sy:e.clientY,x:r.left,y:r.top,id:e.pointerId};
    panel.classList.add('frame-panel-dragging');
    handle.setPointerCapture?.(e.pointerId);
  });
  handle.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const q=clamp(drag.x+e.clientX-drag.sx,drag.y+e.clientY-drag.sy);
    panel.style.left=q.x+'px';panel.style.top=q.y+'px';
  });
  const end=e=>{
    if(!drag|| (e?.pointerId!=null&&e.pointerId!==drag.id))return;
    const r=panel.getBoundingClientRect();
    localStorage.setItem(key,JSON.stringify({x:r.left,y:r.top}));
    drag=null;panel.classList.remove('frame-panel-dragging');
  };
  handle.addEventListener('pointerup',end);
  handle.addEventListener('pointercancel',end);
  addEventListener('resize',()=>{
    if(panel.hidden)return;
    const r=panel.getBoundingClientRect(),q=clamp(r.left,r.top);
    panel.style.left=q.x+'px';panel.style.top=q.y+'px';panel.style.right='auto';
  });
})();

;(()=>{const panel=document.querySelector('#multiPanel'),handle=document.querySelector('#multiPanelDragHandle');if(!panel||!handle)return;const key='infinity-nodes-multi-inspector-position';try{const p=JSON.parse(localStorage.getItem(key)||'null');if(p){panel.style.left=p.x+'px';panel.style.top=p.y+'px';panel.style.right='auto'}}catch{}let d=null;handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const r=panel.getBoundingClientRect();d={x:e.clientX,y:e.clientY,l:r.left,t:r.top};panel.classList.add('multi-panel-dragging');handle.setPointerCapture?.(e.pointerId)});handle.addEventListener('pointermove',e=>{if(!d)return;let x=Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,d.l+e.clientX-d.x)),y=Math.max(4,Math.min(innerHeight-panel.offsetHeight-4,d.t+e.clientY-d.y));panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto'});handle.addEventListener('pointerup',e=>{if(!d)return;d=null;panel.classList.remove('multi-panel-dragging');const r=panel.getBoundingClientRect();localStorage.setItem(key,JSON.stringify({x:r.left,y:r.top}));handle.releasePointerCapture?.(e.pointerId)})})();

