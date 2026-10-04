import { DEFAULT_ALERT_CONFIG } from './config';import { alertConfigSchema,type AlertConfig } from './types';const KEY='finova:alert-preferences:v1';
export function loadAlertConfig():AlertConfig{if(typeof window==='undefined')return DEFAULT_ALERT_CONFIG;try{const x=JSON.parse(localStorage.getItem(KEY)||'null');const p=alertConfigSchema.safeParse({...DEFAULT_ALERT_CONFIG,...x});return p.success?p.data:DEFAULT_ALERT_CONFIG}catch{return DEFAULT_ALERT_CONFIG}}
export function saveAlertConfig(c:AlertConfig){try{localStorage.setItem(KEY,JSON.stringify(c))}catch{}}
