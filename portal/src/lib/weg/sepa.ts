// Reiner Erzeuger einer SEPA-Basislastschrift-Datei (pain.008.001.02) für den
// Hausgeldeinzug. Zero-Key: die Datei wird lokal erzeugt und vom Verwalter selbst
// ins Online-Banking hochgeladen — keine externe API. Beträge in Integer-Cent.
//
// Hinweis: Alle Lastschriften einer Zahlungsgruppe (PmtInf) müssen dieselbe
// Sequenz (FRST/RCUR/OOFF) haben; deshalb wird nach Sequenz gruppiert.

export type SepaSequence = "FRST" | "RCUR" | "OOFF";

export type SepaPayment = {
  endToEndId: string;
  mandateRef: string;
  signedDate: Date;
  sequence: SepaSequence;
  debtorName: string;
  debtorIban: string;
  debtorBic?: string | null;
  amountCents: number;
  remittance: string;
};

export type SepaExportInput = {
  msgId: string;
  creationDateTime: Date;
  creditorName: string;
  creditorIban: string;
  creditorBic?: string | null;
  creditorId: string; // Gläubiger-Identifikationsnummer
  collectionDate: Date; // gewünschter Einzugstermin (ReqdColltnDt)
  payments: SepaPayment[];
};

export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isoDateTime(d: Date): string {
  return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Entfernt bei IBAN/BIC Leerzeichen und normalisiert auf Großbuchstaben.
function cleanBank(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

const SEQUENCE_ORDER: SepaSequence[] = ["FRST", "RCUR", "OOFF"];

export function buildPain008(input: SepaExportInput): string {
  const total = input.payments.reduce((s, p) => s + p.amountCents, 0);
  const nbTx = input.payments.length;

  // Nach Sequenz gruppieren (jede Gruppe → eigener PmtInf-Block).
  const groups = SEQUENCE_ORDER.map((seq) => ({
    seq,
    items: input.payments.filter((p) => p.sequence === seq),
  })).filter((g) => g.items.length > 0);

  const bicOrOthr = (bic?: string | null) =>
    bic && bic.trim()
      ? `<FinInstnId><BIC>${xmlEscape(cleanBank(bic))}</BIC></FinInstnId>`
      : `<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>`;

  const pmtInfBlocks = groups
    .map((g, gi) => {
      const groupTotal = g.items.reduce((s, p) => s + p.amountCents, 0);
      const txs = g.items
        .map(
          (p) => `      <DrctDbtTxInf>
        <PmtId><EndToEndId>${xmlEscape(p.endToEndId)}</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">${formatAmount(p.amountCents)}</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>${xmlEscape(p.mandateRef)}</MndtId><DtOfSgntr>${isoDate(p.signedDate)}</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt>${bicOrOthr(p.debtorBic)}</DbtrAgt>
        <Dbtr><Nm>${xmlEscape(p.debtorName)}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${xmlEscape(cleanBank(p.debtorIban))}</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>${xmlEscape(p.remittance)}</Ustrd></RmtInf>
      </DrctDbtTxInf>`,
        )
        .join("\n");
      return `    <PmtInf>
      <PmtInfId>${xmlEscape(input.msgId)}-${gi + 1}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${g.items.length}</NbOfTxs>
      <CtrlSum>${formatAmount(groupTotal)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>${g.seq}</SeqTp></PmtTpInf>
      <ReqdColltnDt>${isoDate(input.collectionDate)}</ReqdColltnDt>
      <Cdtr><Nm>${xmlEscape(input.creditorName)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${xmlEscape(cleanBank(input.creditorIban))}</IBAN></Id></CdtrAcct>
      <CdtrAgt>${bicOrOthr(input.creditorBic)}</CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchmeId><Id><PrvtId><Othr><Id>${xmlEscape(cleanBank(input.creditorId))}</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>
${txs}
    </PmtInf>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${xmlEscape(input.msgId)}</MsgId>
      <CreDtTm>${isoDateTime(input.creationDateTime)}</CreDtTm>
      <NbOfTxs>${nbTx}</NbOfTxs>
      <CtrlSum>${formatAmount(total)}</CtrlSum>
      <InitgPty><Nm>${xmlEscape(input.creditorName)}</Nm></InitgPty>
    </GrpHdr>
${pmtInfBlocks}
  </CstmrDrctDbtInitn>
</Document>`;
}
