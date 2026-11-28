import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Small parameterized Supabase query adapter used only in tests. It exercises
// the real handler against PostgreSQL, including revision/audit triggers.
const quote=s=>'"'+s.replaceAll('"','""')+'"';
export function attachTestAuthAdmin(db) {
  const usersByEmail = new Map();
  const usersById = new Map();
  db.auth = {
    admin: {
      createUser: async ({ email, user_metadata }) => {
        const key = String(email || '').trim().toLowerCase();
        if (usersByEmail.has(key)) {
          return { data: { user: null }, error: { message: 'User already been registered', status: 422, code: 'email_exists' } };
        }
        const user = { id: randomUUID(), email: key, user_metadata: user_metadata || {} };
        usersByEmail.set(key, user);
        usersById.set(user.id, user);
        return { data: { user }, error: null };
      },
      deleteUser: async id => {
        const existing = usersById.get(id);
        if (existing) {
          usersById.delete(id);
          usersByEmail.delete(existing.email);
        }
        return { data: { user: existing || null }, error: null };
      },
      listUsers: async () => ({ data: { users: Array.from(usersById.values()) }, error: null }),
    },
  };
  return db;
}
export async function database() {
  const pg=new PGlite();
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  await pg.exec(await readFile(new URL('./fixtures/base-schema.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../backend/001-plugin.sql',import.meta.url),'utf8'));
  const db={from:table=>new Query(pg,table),rpc:async(name,args)=>{try {const r=await pg.query(`SELECT public.${quote(name)}(${Object.keys(args).map((k,i)=>quote(k)+' => $'+(i+1)).join(',')}) AS result`,Object.values(args));return {data:r.rows[0].result,error:null};}catch(error){return {data:null,error};}}};
  return {pg,db};
}
class Query {
  constructor(pg,table) {this.pg=pg;this.table=table;this.conditions=[];this.mode='select';this.params=[];}
  bind(v) {this.params.push(v!==null && typeof v==='object'?JSON.stringify(v):v);return '$'+this.params.length;}
  select() {return this;}
  eq(k,v) {this.conditions.push(`${quote(k)} = ${this.bind(v)}`);return this;}
  is(k,v) {if(v!==null)throw Error('Only null supported');this.conditions.push(`${quote(k)} IS NULL`);return this;}
  or(expr) {
    const parts = String(expr).split(',').map(c => c.trim()).filter(Boolean).map(clause => {
      const dot1 = clause.indexOf('.');
      const dot2 = clause.indexOf('.', dot1 + 1);
      if (dot1 <= 0 || dot2 <= dot1 + 1) throw Error('Unsupported or clause: ' + clause);
      const col = clause.slice(0, dot1);
      const op = clause.slice(dot1 + 1, dot2);
      const val = clause.slice(dot2 + 1);
      if (op === 'eq') return `${quote(col)} = ${this.bind(val)}`;
      if (op === 'is' && val === 'null') return `${quote(col)} IS NULL`;
      throw Error('Unsupported or operator: ' + op);
    });
    if (parts.length) this.conditions.push(`(${parts.join(' OR ')})`);
    return this;
  }
  ilike(k,v) {this.conditions.push(`${quote(k)} ILIKE ${this.bind(v)}`);return this;}
  order(k,opts) {this.sort=`${quote(k)}${opts&&opts.ascending===false?' DESC':''}`;return this;}
  limit(n) {this.limitVal=n;return this;}
  range(start,end) {this.offset=start;this.limitVal=end-start+1;return this;}
  insert(payload) {this.mode='insert';this.payload=payload;return this;}
  update(payload) {this.mode='update';this.payload=payload;return this;}
  delete() {this.mode='delete';return this;}
  async run() {
    let sql;
    if(this.mode==='insert') sql=`INSERT INTO ${quote(this.table)} (${Object.keys(this.payload).map(quote).join(',')}) VALUES (${Object.values(this.payload).map(v=>this.bind(v)).join(',')}) RETURNING *`;
    else if(this.mode==='update') sql=`UPDATE ${quote(this.table)} SET ${Object.entries(this.payload).map(([k,v])=>`${quote(k)}=${this.bind(v)}`).join(',')} WHERE ${this.conditions.join(' AND ')} RETURNING *`;
    else if(this.mode==='delete') sql=`DELETE FROM ${quote(this.table)} WHERE ${this.conditions.join(' AND ')} RETURNING *`;
    else sql=`SELECT * FROM ${quote(this.table)}${this.conditions.length?' WHERE '+this.conditions.join(' AND '):''}${this.sort?' ORDER BY '+this.sort:''}${this.limitVal?' LIMIT '+this.limitVal:''}${this.offset?' OFFSET '+this.offset:''}`;
    try {const r=await this.pg.query(sql,this.params);return {data:r.rows,error:null};} catch(error) {return {data:null,error};}
  }
  then(resolve,reject) {return this.run().then(resolve,reject);}
}
