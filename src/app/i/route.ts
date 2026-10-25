import { installScriptResponse } from "@/lib/labs/agent-dist";

/** Short alias for /agent/install.sh, easy to type on a VM console: curl -fsSL <athena>/i | sudo bash */
export function GET(): Promise<Response> {
  return installScriptResponse();
}
