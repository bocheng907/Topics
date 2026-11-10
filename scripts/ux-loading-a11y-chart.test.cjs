/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const jsx = require("react/jsx-runtime");

function load(file, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  const exports = {};
  new Function("exports", "require", "setTimeout", "clearTimeout", code)(exports, name => {
    if (name in mocks) return mocks[name];
    throw new Error("Unexpected dependency: " + name);
  }, globals.setTimeout || setTimeout, globals.clearTimeout || clearTimeout);
  return exports;
}
function nodes(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props && value.props.children)];
}
function makeHarness() {
  const slots = []; let index = 0, dirty = false, pending = [];
  const same = (a,b) => a && b && a.length === b.length && a.every((v,i) => Object.is(v,b[i]));
  const react = {
    useState(initial) {
      const i = index++;
      if (!(i in slots)) slots[i] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[i].value, value => {
        const next = typeof value === "function" ? value(slots[i].value) : value;
        if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; }
      }];
    },
    useCallback(fn,deps) {
      const i=index++, old=slots[i];
      if (!old || !same(old.deps,deps)) slots[i]={ value:fn, deps:[...deps] };
      return slots[i].value;
    },
    useEffect(fn,deps) {
      const i=index++, old=slots[i];
      if (!old || !same(old.deps,deps)) pending.push({i,fn,deps});
    },
  };
  function render(fn) {
    let value, loops=0;
    do { dirty=false; index=0; pending=[]; value=fn(); if (++loops>10) throw Error("render loop"); } while(dirty);
    for (const effect of pending) {
      slots[effect.i]?.cleanup?.();
      slots[effect.i]={deps:[...effect.deps], cleanup:effect.fn()};
    }
    return value;
  }
  return { react, render };
}

test("scoped loading distinguishes empty, failures, retry and stale accounts", () => {
  const h=makeHarness(), timers=[];
  const globals={setTimeout:fn => { const t={fn,active:true}; timers.push(t); return t; }, clearTimeout:t => {t.active=false;}};
  const {useScopedSnapshot}=load("src/data/useScopedSnapshot.ts", {react:h.react}, globals);
  const subscriptions=[];
  const subscribe=(success,error) => { const sub={success,error,closed:false}; subscriptions.push(sub); return () => {sub.closed=true;}; };
  let scope="user/patient-a", ready=true;
  const render=() => h.render(() => useScopedSnapshot(scope,ready,subscribe));
  let result=render(); assert.equal(result.status,"loading");
  subscriptions[0].success([]); result=render(); assert.equal(result.status,"ready"); assert.deepEqual(result.data,[]);
  scope="user/patient-b"; result=render(); assert.equal(result.status,"loading"); assert.equal(result.data,null); assert.equal(subscriptions[0].closed,true);
  subscriptions[0].success(["stale"]); result=render(); assert.equal(result.status,"loading");
  scope="user/patient-a"; result=render(); assert.equal(result.status,"loading"); assert.equal(result.data,null);
  subscriptions[2].error(); result=render(); assert.equal(result.status,"error");
  result.retry(); result=render(); assert.equal(result.status,"loading");
  subscriptions[3].success(["new"]); result=render(); assert.equal(result.status,"ready"); assert.deepEqual(result.data,["new"]);
  ready=false; result=render(); assert.equal(result.status,"loading"); assert.equal(result.data,null);
});

test("slow data becomes retryable and can recover after timeout", () => {
  const h=makeHarness(), timers=[];
  const {useScopedSnapshot}=load("src/data/useScopedSnapshot.ts", {react:h.react}, {
    setTimeout:fn => {const t={fn,active:true};timers.push(t);return t;}, clearTimeout:t=>{t.active=false;},
  });
  let success; const subscribe=(ok)=>{success=ok;return()=>{};};
  const render=()=>h.render(()=>useScopedSnapshot("scope",true,subscribe));
  assert.equal(render().status,"loading"); timers[0].fn(); assert.equal(render().status,"error");
  success(["available"]); assert.equal(render().status,"ready");
});

test("cached data stays visible during timeout and recovers when the server responds", () => {
  const h=makeHarness(), timers=[];
  const {useScopedSnapshot}=load("src/data/useScopedSnapshot.ts", {react:h.react}, {
    setTimeout:fn => {const t={fn,active:true};timers.push(t);return t;}, clearTimeout:t=>{t.active=false;},
  });
  let success, error; const subscribe=(ok,fail)=>{success=ok;error=fail;return()=>{};};
  const render=()=>h.render(()=>useScopedSnapshot("scope",true,subscribe));
  assert.equal(render().status,"loading");
  success([],true); let result=render(); assert.equal(result.status,"cached"); assert.deepEqual(result.data,[]);
  success(["saved"],true); result=render(); assert.equal(result.status,"cached"); assert.deepEqual(result.data,["saved"]);
  timers[0].fn(); result=render(); assert.equal(result.status,"error"); assert.deepEqual(result.data,["saved"]);
  success(["updated"],false); result=render(); assert.equal(result.status,"ready"); assert.deepEqual(result.data,["updated"]);
  success(["updated"],true); result=render(); assert.equal(result.status,"cached"); assert.equal(timers.length,2);
  timers[1].fn(); result=render(); assert.equal(result.status,"error"); assert.deepEqual(result.data,["updated"]);
  success(["online"],false); assert.equal(render().status,"ready");
  error(); result=render(); assert.equal(result.status,"error"); assert.deepEqual(result.data,["online"]);
  result.retry(); assert.equal(render().status,"loading");
  success([],false); result=render(); assert.equal(result.status,"ready"); assert.deepEqual(result.data,[]);
});

test("chat preview distinguishes cached and server-confirmed snapshots", () => {
  let watcher, sent=[]; let opts;
  const firestore={ collection:()=>({}), query:()=>({}), orderBy:()=>({}), limit:()=>({}),
    onSnapshot:(_q,options,success,error) => { opts=options; watcher={success,error}; return ()=>{}; } };
  const {useLastChatMessage}=load("src/chat/useLastChatMessage.ts", {
    react:{useCallback:fn=>fn}, "firebase/firestore":firestore, "@/firebase/firebaseConfig":{db:{}},
    "@/src/auth/useAuth":{useAuth:()=>({user:{uid:"u"},ready:true})},
    "@/src/data/useScopedSnapshot":{useScopedSnapshot:(scope,ready,subscribe)=>{subscribe((v,cached)=>sent.push({v,cached}),()=>{});return {scope,ready};}},
    "./rooms":{chatMessageCollection:()=>"messages"},
  });
  useLastChatMessage("p","caregiver",true); assert.equal(opts.includeMetadataChanges,true);
  watcher.success({metadata:{fromCache:true},empty:true,docs:[]}); assert.deepEqual(sent[0],{v:null,cached:true});
  watcher.success({metadata:{fromCache:true},empty:false,docs:[{id:"c",data:()=>({text:"saved"})}]});
  assert.equal(sent[1].v.text,"saved"); assert.equal(sent[1].cached,true);
  watcher.success({metadata:{fromCache:false},empty:true,docs:[]}); assert.deepEqual(sent[2],{v:null,cached:false});
  watcher.success({metadata:{fromCache:false},empty:false,docs:[{id:"m",data:()=>({text:"hello"})}]});
  assert.equal(sent[3].v.text,"hello"); assert.equal(sent[3].cached,false);
});

test("caregiver home waits for confirmed reminders and logs before allowing DONE", () => {
  const {reminderLoadState}=load("src/reminders/reminderLoadState.ts");
  assert.deepEqual(reminderLoadState("loading","loading",false), {feedback:"loading",showReminder:false,canConfirm:false});
  assert.deepEqual(reminderLoadState("cached","cached",false), {feedback:"cached",showReminder:false,canConfirm:false});
  assert.deepEqual(reminderLoadState("cached","ready",true), {feedback:"cached",showReminder:true,canConfirm:false});
  assert.deepEqual(reminderLoadState("ready","error",false), {feedback:"error",showReminder:true,canConfirm:false});
  assert.deepEqual(reminderLoadState("ready","ready",false), {feedback:"ready",showReminder:true,canConfirm:true});
});

test("dense chart keeps a full date for the data point even when its axis label is hidden", () => {
  const {formatChartDate,formatChartAxisLabel}=load("src/health/chartDate.ts");
  const when=new Date(2026,10,8,20,58).getTime();
  assert.equal(formatChartAxisLabel(when,1,8),""); assert.equal(formatChartDate(when),"2026/11/08 20:58");
  const copy=load("src/health/healthChartCopy.ts").healthChartCopy;
  const chart=load("src/health/HealthLineChart.web.tsx", {react:React,"react/jsx-runtime":jsx,
    "@/src/store/LanguageContext":{useLanguage:()=>({language:"zh"})},"./healthChartCopy":{healthChartCopy:copy}}).LineChart;
  const circle=nodes(chart({data:[{value:37.6,label:"",dateLabel:formatChartDate(when)}]})).find(n=>n.type==="circle");
  assert.equal(nodes(circle).find(n=>n.type==="title").props.children.join(""),"2026/11/08 20:58：37.6");
});

test("translated messages retain the sender's exact original, without duplication on failure", () => {
  const TextComponent=load("src/chat/TranslatedChatText.tsx", {react:React,"react/jsx-runtime":jsx,
    "react-native":{Text:"Text",View:"View"},"./ChatTranslationStatus":{chatTranslationCopy:{en:{original:"Original"}}}}).TranslatedChatText;
  const original="水杯放在桌上，晚點再提醒喝水。";
  const translated="The water cup is on the table; remind me to drink water later.";
  let textNodes=nodes(TextComponent({language:"en",original,translated})).filter(n=>n.type==="Text");
  assert.equal(textNodes.length,2); assert.equal(textNodes[0].props.children,translated);
  assert.ok(textNodes[1].props.children.includes(original));
  textNodes=nodes(TextComponent({language:"en",original,translated:original})).filter(n=>n.type==="Text");
  assert.equal(textNodes.length,1);
});

test("daily checklist exposes checked state and handles space without repeat", () => {
  const copy=load("src/i18n/copy/calendarCopy.ts").calendarCopy;
  const scalar=new Proxy({}, {get:()=>8});
  const theme={colors:scalar,spacing:scalar,radii:scalar,typography:new Proxy({}, {get:()=>({})})};
  const ui=Object.fromEntries(["Button","Card","Divider","IconButton","StatusBadge","TextField"].map(v=>[v,v]));
  const native={Platform:{OS:"web"},ActivityIndicator:"ActivityIndicator",Pressable:"Pressable",StyleSheet:{create:x=>x},Text:"Text",View:"View"};
  const Checklist=load("src/calendar/components/DailyChecklistCard.tsx", {react:React,"react/jsx-runtime":jsx,
    "react-native":native,"@/src/i18n/copy/calendarCopy":{calendarCopy:copy},
    "@/src/store/LanguageContext":{useLanguage:()=>({language:"zh"})},"@/src/ui/components":ui,
    "@/src/ui/theme":theme,"@expo/vector-icons":{Ionicons:"Ionicons"}}).DailyChecklistCard;
  const toggled=[];
  const tree=Checklist({date:new Date(),items:[{id:"a",title:"Drink water",completed:false},{id:"b",title:"Rest",completed:true}],
    doneCount:1,expanded:true,onToggleExpanded:()=>{},input:"",onChangeInput:()=>{},editing:false,onSubmit:()=>{},onCancelEdit:()=>{},
    onToggleItem:id=>toggled.push(id),onEditItem:()=>{},onDeleteItem:()=>{}});
  const boxes=nodes(tree).filter(n=>n.props?.accessibilityRole==="checkbox");
  assert.equal(boxes.length,2); assert.equal(boxes[0].props["aria-checked"],false); assert.equal(boxes[1].props["aria-checked"],true);
  let prevented=0; boxes[0].props.onKeyDown({key:" ",preventDefault:()=>prevented++});
  boxes[0].props.onKeyDown({key:" ",repeat:true,preventDefault:()=>prevented++});
  assert.deepEqual(toggled,["a"]); assert.equal(prevented,2);
  const {renderToStaticMarkup}=require("react-dom/server"); const {Pressable,Text}=require("react-native-web");
  const html=renderToStaticMarkup(React.createElement(Pressable,{accessibilityRole:"checkbox",accessibilityState:{checked:true},
    "aria-checked":true,accessibilityLabel:"Rest",onPress:()=>{}},React.createElement(Text,null,"Rest")));
  assert.match(html,/role="checkbox"/); assert.match(html,/aria-checked="true"/);
});


test("calendar event checkbox exposes its real state and supports space", () => {
  const copy=load("src/i18n/copy/calendarCopy.ts").calendarCopy;
  const scalar=new Proxy({}, {get:()=>8});
  const theme={colors:scalar,spacing:scalar,radii:scalar,layout:scalar,typography:new Proxy({}, {get:()=>({})})};
  const ui=Object.fromEntries(["Button","Card","EmptyState","IconButton"].map(v=>[v,v]));
  const native={Platform:{OS:"web"},ActivityIndicator:"ActivityIndicator",Pressable:"Pressable",StyleSheet:{create:x=>x},Text:"Text",View:"View"};
  const Card=load("src/calendar/components/DayAgenda.tsx", {react:React,"react/jsx-runtime":jsx,
    "react-native":native,"@/src/i18n/copy/calendarCopy":{calendarCopy:copy},
    "@/src/store/LanguageContext":{useLanguage:()=>({language:"zh"})},"@/src/ui/components":ui,
    "@/src/ui/theme":theme,"@expo/vector-icons":{Ionicons:"Ionicons"}}).AgendaEventCard;
  let toggles=0;
  const tree=Card({time:"4:05",period:"PM",color:"blue",title:"Organize supplies",completed:true,
    onToggleComplete:()=>toggles++,onEdit:()=>{},onDelete:()=>{}});
  const box=nodes(tree).find(n=>n.props?.accessibilityRole==="checkbox");
  assert.equal(box.props["aria-checked"],true); assert.equal(box.props.accessibilityState.checked,true);
  let prevented=false; box.props.onKeyDown({key:" ",preventDefault:()=>{prevented=true;}});
  assert.equal(toggles,1); assert.equal(prevented,true);
});
