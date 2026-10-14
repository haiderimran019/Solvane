import Link from "next/link";
import {env} from "cloudflare:workers";
import {count,gte,sql} from "drizzle-orm";
import {getDb} from "../../db";
import {usageEvents} from "../../db/schema";
import {apiUser} from "../../lib/server";
export const dynamic="force-dynamic";
export default async function FounderMetrics(){
  const user=await apiUser(),founder=(env as unknown as Record<string,string>).FOUNDER_METRICS_USER_ID;
  if(!user||!founder||user.userId!==founder)return <main style={{padding:40}}><Link href="/">← Workspace</Link><h1>Founder metrics</h1><p>This page is restricted to the founder account. Configure FOUNDER_METRICS_USER_ID in the server environment.</p></main>;
  const rows=await getDb().select({name:usageEvents.eventName,value:count()}).from(usageEvents).where(gte(usageEvents.createdAt,sql`strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')`)).groupBy(usageEvents.eventName);
  return <main style={{maxWidth:850,margin:"40px auto",padding:24}}><Link href="/">← Workspace</Link><h1>Founder metrics · last 7 days</h1><p>Consent-based events only. No chat text or capsule contents. A handoff started records an opening; it does not prove the user sent a prompt in the other provider.</p><table><thead><tr><th>Event</th><th>Count</th></tr></thead><tbody>{rows.map(row=><tr key={row.name}><td>{row.name}</td><td>{Number(row.value)}</td></tr>)}</tbody></table>{!rows.length&&<p>No consented events yet.</p>}</main>;
}
