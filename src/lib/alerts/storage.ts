import type { AlertState } from './types';import { emptyAlertState } from './state';
const key=(orgId:string,userId:string)=>`finova:alerts:v1:${orgId}:${userId}`;
export function loadAlertState(orgId:string,userId:string):AlertState{if(typeof window==='undefined')return emptyAlertState();try{const raw=localStorage.getItem(key(orgId,userId));if(!raw)return emptyAlertState();const x=JSON.parse(raw);return x?.version===1?x:emptyAlertState()}catch{return emptyAlertState()}}
export function saveAlertState(orgId:string,userId:string,state:AlertState){try{localStorage.setItem(key(orgId,userId),JSON.stringify(state));return true}catch{return false}}
export function clearAlertState(orgId:string,userId:string){try{localStorage.removeItem(key(orgId,userId))}catch{}}
