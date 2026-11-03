import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseMeasurementRefused, refusePurchaseMeasurement, rememberPurchaseChoice, measurementPost } from './memoryPurchaseMeasurement.js';
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
test('retained order choices can withdraw receipt-free purchases using only their scoped bearer',async()=>{
 const w=browser(),choice={orderId:'order_fixture',token:'f'.repeat(64)},calls=[];
 assert.equal(rememberPurchaseChoice(choice,w),true);assert.equal(rememberPurchaseChoice(choice,w),true);
 await refusePurchaseMeasurement(async(path,body)=>{calls.push({path,body});return path.endsWith('purchase-choice')?{ok:true,data:{ok:true}}:{ok:true,data:decline};},w);
 assert.equal(calls.filter(c=>c.path.endsWith('purchase-choice')).length,1);
 assert.deepEqual(calls[0].body,{...choice,action:'withdraw'});
});
test('failed storage never confirms choice readiness, and failed server withdrawal remains visible',async()=>{
 const w=browser();w.localStorage.setItem=()=>{throw Error('denied');};
 assert.equal(rememberPurchaseChoice({orderId:'x',token:'f'.repeat(64)},w),false);
 const v=browser();rememberPurchaseChoice({orderId:'x',token:'f'.repeat(64)},v);
 await assert.rejects(refusePurchaseMeasurement(async path=>path.endsWith('purchase-choice')?{ok:false}:{ok:true,data:decline},v),/not yet confirmed/);
 assert.equal(purchaseMeasurementRefused(v),true);
});

test('measurement timeout is bounded so optional acknowledgement cannot stall payment',async()=>{
 await assert.rejects(measurementPost(()=>new Promise(()=>{}),'/memory-meta/purchase-choice',{}, {timeoutMs:5}),/MEASUREMENT_TIMEOUT/);
});
