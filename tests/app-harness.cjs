const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = function loadApp(project = path.resolve(__dirname, '..')) {
  const elements = new Map();
  const timers=[];
  const element = () => ({textContent:'',innerHTML:'',value:'',dataset:{},style:{},
    classList:{add(){},remove(){},toggle(){}},addEventListener(){},appendChild(){},insertAdjacentHTML(){}});
  const context = {console, URL, Date, Math, Set, Map, JSON, Promise,
    setTimeout:(callback,delay=0)=>{timers.push({callback,delay});return timers.length;},clearTimeout(id){timers[id-1]=null;},
    document:{readyState:'loading',addEventListener(){},querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s);},querySelectorAll:()=>[],createElement:element},
    localStorage:{getItem:()=>null,setItem(){}},fetch:()=>Promise.reject(new Error('Unexpected network request in test'))};
  context.window=context;
  vm.createContext(context);
  const core=path.join(project,'app/src/main/assets/www/js/planner-core.js');
  if(fs.existsSync(core))vm.runInContext(fs.readFileSync(core,'utf8'),context);
  const file=path.join(project,'app/src/main/assets/www/js/app.js');
  let source=fs.readFileSync(file,'utf8');
  const exports=['loadState','emptyState','sampleTrip','setWishlistSelection','resolveWishlistNodes','buildAutomaticRoute','computeDay','dayConstraints','cloneVersion','planningIssueCount','objectOpenIssues','accommodationsForDate','daysBetween','addDays','Providers','wishlistKey','versionMetrics'];
  if(source.includes('function normalizeLoadedState('))exports.push('normalizeLoadedState','publicWildObservation','invalidateStopRoutes','getWishlistEntry','connectionModal','transferModal','showModal','closeModal','openSuggestionDetail','persistSoon','refreshDayRoutes','syncConnectionTransfers');
  source=source.replace(/\n\}\)\(\);\s*$/,`\nwindow.appTest={${exports.join(',')},setState:s=>state=s,getState:()=>state};\n})();`);
  vm.runInContext(source,context,{filename:file});
  const app=context.appTest;
  app.setState(app.emptyState());
  return {app,context,elements,flushTimers(maxDelay=0){for(let i=0;i<timers.length;i++){const task=timers[i];if(task&&task.delay<=maxDelay){timers[i]=null;task.callback();}}}};
};
