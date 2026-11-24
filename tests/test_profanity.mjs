// lib/profanity.mjs: masks abusive words in English, Hindi and Tamil (romanised and Tamil script).
import assert from 'node:assert/strict';
import {maskProfanity,maskRecord,maskText} from '../lib/profanity.mjs';
const eq=assert.equal;
eq(maskProfanity('losu kuthi show').text,'l*** k**** show');
eq(maskProfanity('you idiots are stupid').text,'you i***** are s*****');
eq(maskProfanity('fucking hell').masked,1);
for(const clean of ['Scunthorpe','Dickens','kuthikum','Ooroda Oththa Don','ஒத்த ரூபா'])eq(maskProfanity(clean).masked,0,clean);
const r=maskRecord({text:'what a bitch',topic_summary:'calling it bastard'});eq(r.abusive,true);eq(r.topic_summary,'calling it b******');
eq(maskText('இவன் தேவடியா'),'இவன் தே***'); // Tamil script: first letter kept
console.log('Profanity masking checks passed.');
