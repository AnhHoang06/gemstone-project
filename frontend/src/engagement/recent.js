const key='gem-aurelia:recent-products';
export function readRecent() {try {const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?[...new Set(v.filter(n=>Number.isSafeInteger(n)&&n>0))].slice(0,12):[];}catch{return [];}}
export function recordRecent(id) {const ids=[id,...readRecent().filter(n=>n!==id)].slice(0,12);try{localStorage.setItem(key,JSON.stringify(ids));}catch{/* Browsing also works when storage is disabled. */}return ids;}
