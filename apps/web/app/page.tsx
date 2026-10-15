import { requireChatGPTUser } from "./chatgpt-auth";
import { RelayDashboard } from "./relay-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <RelayDashboard user={{ name: user.displayName, email: user.email }} />;
}
