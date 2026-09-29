import {describe,it,expect} from 'vitest';
import {validate} from '@/lib/ledger';
describe('ledger validation',()=>{const accounts=new Map([['cash',{id:'cash',isActive:true}],['sales',{id:'sales',isActive:true}]]);it('rejects unbalanced entries with exact difference',()=>{try{validate({date:'2026-09-28',memo:'x',source:'MANUAL',lines:[{accountId:'cash',debit:500,credit:0},{accountId:'sales',debit:0,credit:400}]},accounts);throw Error('expected rejection')}catch(e){expect(e).toMatchObject({code:'UNBALANCED',details:{difference:100}})}});it('rejects a single line',()=>{expect(()=>validate({date:'2026-09-28',memo:'x',source:'MANUAL',lines:[{accountId:'cash',debit:1,credit:0}]},accounts)).toThrow()})});

import {toPaise} from '@/lib/money';
import {canonicalEntry} from '@/lib/ledger';
describe('money & hash',()=>{it('toPaise handles float edge cases',()=>{expect(toPaise(1.005)).toBe(101);expect(toPaise('19.90')).toBe(1990);expect(toPaise('-0.5')).toBe(-50)});it('hash covers sourceRef',()=>{const b={entryNo:1,date:'d',memo:'m',source:'MANUAL' as const,lines:[]};expect(canonicalEntry({...b,sourceRef:'a'})).not.toBe(canonicalEntry({...b,sourceRef:'b'}))})});
