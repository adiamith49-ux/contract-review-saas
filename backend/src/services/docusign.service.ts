import docusign from "docusign-esign";
import { config } from "../config.js";

export interface SignatureParty {
  name: string;
  email: string;
}

export interface EnvelopeResult {
  envelopeId: string;
  status: string;
}

export interface RecipientStatus {
  name: string;
  email: string;
  routing_order: number;
  status: string; // created | sent | delivered | signed | declined | autoresponded
  signed_at: string | null;
}

export function isDocuSignConfigured(): boolean {
  return !!(
    config.DOCUSIGN_INTEGRATION_KEY &&
    config.DOCUSIGN_USER_ID &&
    config.DOCUSIGN_ACCOUNT_ID &&
    config.DOCUSIGN_PRIVATE_KEY
  );
}

// JWT Grant (server-to-server) — no per-user OAuth redirect. The private key's
// newlines commonly get flattened to "\n" literals when pasted into a .env file
// or a platform's env var UI, so normalize them back before signing.
async function getAuthenticatedApiClient() {
  const apiClient = new docusign.ApiClient();
  apiClient.setOAuthBasePath(config.DOCUSIGN_OAUTH_BASE_PATH);

  const privateKey = config.DOCUSIGN_PRIVATE_KEY.includes("\\n")
    ? config.DOCUSIGN_PRIVATE_KEY.replace(/\\n/g, "\n")
    : config.DOCUSIGN_PRIVATE_KEY;

  try {
    const results = await apiClient.requestJWTUserToken(
      config.DOCUSIGN_INTEGRATION_KEY,
      config.DOCUSIGN_USER_ID,
      ["signature", "impersonation"],
      Buffer.from(privateKey, "utf8"),
      3600,
    );
    apiClient.setBasePath(config.DOCUSIGN_BASE_PATH);
    apiClient.addDefaultHeader("Authorization", `Bearer ${results.body.access_token}`);
    return apiClient;
  } catch (err: any) {
    // First-time setup requires one-time user consent to this integration key —
    // DocuSign returns consent_required instead of a token until that's granted.
    // Note: docusign-esign only remaps axios's `response.data` to `response.body`
    // on the SUCCESS path (see its ApiClient.js) — a rejected/thrown error keeps
    // the raw axios shape, so this must read `.data`, not `.body`.
    const errorCode = err?.response?.data?.error;
    if (errorCode === "consent_required") {
      const consentUrl =
        `https://${config.DOCUSIGN_OAUTH_BASE_PATH}/oauth/auth?response_type=code` +
        `&scope=signature%20impersonation&client_id=${config.DOCUSIGN_INTEGRATION_KEY}` +
        `&redirect_uri=${encodeURIComponent(config.WEB_URL)}`;
      console.error(`[docusign] Consent required — visit this URL once, logged in as DOCUSIGN_USER_ID, then retry: ${consentUrl}`);
      throw new Error("DocuSign integration needs one-time consent — see server logs for the consent URL.");
    }
    throw err;
  }
}

function fileExtensionFor(mimeType: string): string {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("word") || mimeType.includes("officedocument")) return "docx";
  return "pdf";
}

// Sends the contract as a DocuSign envelope with one Sign Here tab per party,
// stacked on page 1 (the source contract has no anchor text we can rely on to
// auto-place fields, so fixed positions are the simplest reliable default).
export async function createAndSendEnvelope(params: {
  documentBuffer: Buffer;
  documentName: string;
  mimeType: string;
  parties: SignatureParty[];
}): Promise<EnvelopeResult> {
  const apiClient = await getAuthenticatedApiClient();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  const doc = docusign.Document.constructFromObject({
    documentBase64: params.documentBuffer.toString("base64"),
    name: params.documentName,
    fileExtension: fileExtensionFor(params.mimeType),
    documentId: "1",
  });

  const signers = params.parties.map((party, i) => {
    const signHere = docusign.SignHere.constructFromObject({
      documentId: "1",
      pageNumber: "1",
      xPosition: "100",
      yPosition: String(120 + i * 70),
    });
    return docusign.Signer.constructFromObject({
      email: party.email,
      name: party.name,
      recipientId: String(i + 1),
      routingOrder: String(i + 1),
      tabs: docusign.Tabs.constructFromObject({ signHereTabs: [signHere] }),
    });
  });

  const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
    emailSubject: `Please sign: ${params.documentName}`,
    documents: [doc],
    recipients: docusign.Recipients.constructFromObject({ signers }),
    status: "sent",
  });

  const result = await envelopesApi.createEnvelope(config.DOCUSIGN_ACCOUNT_ID, { envelopeDefinition });
  return { envelopeId: result.envelopeId, status: result.status };
}

export async function getEnvelopeStatus(envelopeId: string): Promise<{
  status: string;
  recipients: RecipientStatus[];
}> {
  const apiClient = await getAuthenticatedApiClient();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  const [envelope, recipients] = await Promise.all([
    envelopesApi.getEnvelope(config.DOCUSIGN_ACCOUNT_ID, envelopeId),
    envelopesApi.listRecipients(config.DOCUSIGN_ACCOUNT_ID, envelopeId),
  ]);

  const signers = (recipients.signers ?? []).map((s: any) => ({
    name: s.name,
    email: s.email,
    routing_order: Number(s.routingOrder ?? 1),
    status: s.status,
    signed_at: s.signedDateTime ?? null,
  }));

  return { status: envelope.status, recipients: signers };
}

export function voidEnvelope(envelopeId: string, reason: string) {
  return getAuthenticatedApiClient().then((apiClient) => {
    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    return envelopesApi.update(config.DOCUSIGN_ACCOUNT_ID, envelopeId, {
      envelope: docusign.Envelope.constructFromObject({ status: "voided", voidedReason: reason }),
    });
  });
}
