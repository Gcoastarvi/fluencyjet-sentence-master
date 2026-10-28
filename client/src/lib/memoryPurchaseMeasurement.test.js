import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseMeasurementRefused, refusePurchaseMeasurement } from './memoryPurchaseMeasurement.js';
import { readMemoryConsent, saveMemoryConsent } from './memoryMetaConsent.js';
function browser() { const values=new Map(); return {navigator:{}, dispatchEvent(){}, localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}}; }
const decline={ok:true,granted:false,receipt:'a'.repeat(64),version:'memory_meta_v1',expiresAt:'2099-01-01'};
test('explicit withdrawal reuses existing consent endpoint and saves the server-confirmed decline',async()=>{
 const w=browser(),calls=[]; saveMemoryConsent({...decline,granted:true},w);
 await refusePurchaseMeasurement(async(path,body)=>{calls.push({path,body});return {ok:true,data:decline};},w);
 assert.deepEqual(calls,[{path:'/memory-meta/consent',body:{receipt:'a'.repeat(64),granted:false}}]);
 assert.equal(purchaseMeasurementRefused(w),true); assert.equal(readMemoryConsent(w).granted,false); assert.equal(w.memoryMetaConsentVerified,false);
});
test('withdrawal failure is visible while local refusal persists',async()=>{
 const w=browser();
 await assert.rejects(refusePurchaseMeasurement(async()=>({ok:false}),w),/not yet confirmed/);
 assert.equal(purchaseMeasurementRefused(w),true); assert.equal(readMemoryConsent(w).granted,false);
});
test('GPC and unavailable storage fail closed',()=>{
 const w=browser(); w.navigator.globalPrivacyControl=true; assert.equal(purchaseMeasurementRefused(w),true);
 w.localStorage={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
 assert.equal(purchaseMeasurementRefused(w),true);
});
