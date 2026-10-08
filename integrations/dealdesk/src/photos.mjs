import { request } from 'node:https';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { fail } from './domain.mjs';

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export function photoUrl(value) {
  // Exact CDN origin and simple image paths: no credentials, alternate ports, escapes or redirects.
  if (typeof value !== 'string' || value.length > 2048 || !/^https:\/\/photos\.zillowstatic\.com\/[A-Za-z0-9_/-]+\.(?:jpg|jpeg|png|webp)$/.test(value))
    fail('INVALID_PHOTO', 'Use a direct HTTPS JPEG, PNG or WebP URL on photos.zillowstatic.com.');
  return value;
}
const blocked = new BlockList();
for (const [ip,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]]) blocked.addSubnet(ip,bits,'ipv4');
const global6 = new BlockList(); global6.addSubnet('2000::',3,'ipv6');
for (const [ip,bits] of [['2001::',23],['2001:db8::',32],['2002::',16]]) blocked.addSubnet(ip,bits,'ipv6');
export function publicAddress(address) {
  const family=isIP(address);
  return family===4 ? !blocked.check(address,'ipv4') : family===6 && global6.check(address,'ipv6') && !blocked.check(address,'ipv6');
}
export function imageSignature(prefix,type) {
  return type==='image/jpeg' ? prefix.length>=3 && prefix[0]===255 && prefix[1]===216 && prefix[2]===255
    : type==='image/png' ? prefix.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : type==='image/webp' && prefix.toString('ascii',0,4)==='RIFF' && prefix.toString('ascii',8,12)==='WEBP';
}
export async function validatePhoto(value,{resolve=lookup,open=request}={}) {
  const url=photoUrl(value);
  const addresses=await resolve('photos.zillowstatic.com',{all:true});
  if (!addresses.length || addresses.some(a=>!publicAddress(a.address))) fail('INVALID_PHOTO','Photo hostname resolved to an unsafe address.');
  const target=addresses[0];
  await new Promise((resolve,reject)=>{
    let timer;
    const req=open(url,{
      method:'GET',agent:false,headers:{Accept:'image/jpeg,image/png,image/webp','Accept-Encoding':'identity'},
      // Pin the checked address while preserving hostname/SNI/certificate verification.
      lookup:(_host,options,callback)=>options.all ? callback(null,[target]) : callback(null,target.address,target.family),
    },res=>{
      const type=String(res.headers['content-type']||'').split(';')[0].trim().toLowerCase();
      const length=Number(res.headers['content-length']);
      const stop=()=>{res.destroy();req.destroy();reject(new Error('Invalid photo response'));};
      if(res.statusCode!==200 || !['image/jpeg','image/png','image/webp'].includes(type) || (res.headers['content-encoding'] && res.headers['content-encoding']!=='identity') || length>MAX_PHOTO_BYTES) return stop();
      let size=0,prefix=Buffer.alloc(0);
      res.on('data',chunk=>{size+=chunk.length;if(prefix.length<12) prefix=Buffer.concat([prefix,chunk.subarray(0,12-prefix.length)]);if(size>MAX_PHOTO_BYTES) stop();});
      res.on('error',reject);
      res.on('end',()=>size>0 && size<=MAX_PHOTO_BYTES && imageSignature(prefix,type) ? resolve() : reject(new Error('Invalid image bytes')));
    });
    timer=setTimeout(()=>req.destroy(new Error('Photo timeout')),8000);
    req.on('error',reject);req.on('close',()=>clearTimeout(timer));req.end();
  }).catch(()=>fail('INVALID_PHOTO','Photo must be a reachable, non-redirecting JPEG, PNG or WebP image no larger than 8 MiB.'));
  return url;
}
export async function validatePhotos(urls) {
  const unique=[...new Set(urls.map(photoUrl))];
  // Bounded batch concurrency keeps validation inside the hosted request deadline.
  for(let i=0;i<unique.length;i+=5) await Promise.all(unique.slice(i,i+5).map(url=>validatePhoto(url)));
  return unique;
}
