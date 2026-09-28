import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

// Small parameterized Supabase query adapter used only in tests. It exercises
// the real handler against PostgreSQL, including revision/audit triggers.
const quote=s=>'"'+s.replaceAll('"','""')+'"';
export async function database() {
  const pg=new PGlite();
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  await pg.exec(await readFile(new URL('./fixtures/base-schema.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../backend/001-plugin.sql',import.meta.url),'utf8'));
  const db={from:table=>new Query(pg,table)};
  return {pg,db};
}
class Query {
  constructor(pg,table) {this.pg=pg;this.table=table;this.conditions=[];this.mode='select';this.params=[];}
  bind(v) {this.params.push(v!==null && typeof v==='object'?JSON.stringify(v):v);return '$'+this.params.length;}
  select() {return this;}
  eq(k,v) {this.conditions.push(`${quote(k)} = ${this.bind(v)}`);return this;}
  is(k,v) {if(v!==null)throw Error('Only null supported');this.conditions.push(`${quote(k)} IS NULL`);return this;}
  ilike(k,v) {this.conditions.push(`${quote(k)} ILIKE ${this.bind(v)}`);return this;}
  order(k) {this.sort=quote(k);return this;}
  range(start,end) {this.offset=start;this.limit=end-start+1;return this;}
  insert(payload) {this.mode='insert';this.payload=payload;return this;}
  update(payload) {this.mode='update';this.payload=payload;return this;}
  async run() {
    let sql;
    if(this.mode==='insert') sql=`INSERT INTO ${quote(this.table)} (${Object.keys(this.payload).map(quote).join(',')}) VALUES (${Object.values(this.payload).map(v=>this.bind(v)).join(',')}) RETURNING *`;
    else if(this.mode==='update') sql=`UPDATE ${quote(this.table)} SET ${Object.entries(this.payload).map(([k,v])=>`${quote(k)}=${this.bind(v)}`).join(',')} WHERE ${this.conditions.join(' AND ')} RETURNING *`;
    else sql=`SELECT * FROM ${quote(this.table)}${this.conditions.length?' WHERE '+this.conditions.join(' AND '):''}${this.sort?' ORDER BY '+this.sort:''}${this.limit?' LIMIT '+this.limit:''}${this.offset?' OFFSET '+this.offset:''}`;
    try {const r=await this.pg.query(sql,this.params);return {data:r.rows,error:null};} catch(error) {return {data:null,error};}
  }
  then(resolve,reject) {return this.run().then(resolve,reject);}
}
