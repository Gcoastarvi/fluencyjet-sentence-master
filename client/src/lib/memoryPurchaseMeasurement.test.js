import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseMeasurementRefused, rememberPurchaseAuthorization, refusePurchaseMeasurement } from './memoryPurchaseMeasurement.js';
function browser() { const values = new Map(); return { navigator: {}, localStorage: { getItem:k=>values.get(k)||null, setItem:(k,v)=>values.set(k,v) } }; }
test('withdrawal saves refusal and revokes each retained bearer once', async()=>{
 const w=browser(), token='a'.repeat(64), calls=[];
 assert.equal(purchaseMeasurementRefused(w),false);
 assert.equal(rememberPurchaseAuthorization(token,w),true); rememberPurchaseAuthorization(token,w);
 await refusePurchaseMeasurement(async(path,body)=>{calls.push({path,body});return {ok:true,data:{ok:true}};},w);
 assert.equal(calls.length,1); assert.equal(calls[0].body.token,token); assert.equal(purchaseMeasurementRefused(w),true);
});
test('withdrawal failure is visible while local refusal persists',async()=>{
 const w=browser(); rememberPurchaseAuthorization('b'.repeat(64),w);
 await assert.rejects(refusePurchaseMeasurement(async()=>({ok:false}),w),/not yet confirmed/);
 assert.equal(purchaseMeasurementRefused(w),true);
});
test('GPC and unavailable storage fail closed, without fabricating authorization',()=>{
 const w=browser(); w.navigator.globalPrivacyControl=true; assert.equal(purchaseMeasurementRefused(w),true);
 w.localStorage={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
 assert.equal(purchaseMeasurementRefused(w),true); assert.equal(rememberPurchaseAuthorization('c'.repeat(64),w),false);
 assert.equal(rememberPurchaseAuthorization('invalid',browser()),false);
});
