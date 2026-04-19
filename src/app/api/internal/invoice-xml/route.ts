import { NextRequest, NextResponse } from 'next/server';

// ── ZUGFeRD 2.1 / Factur-X EN 16931 XML Generator ────────────────────────────
// Generates a valid Cross Industry Invoice (CII) XML for electronic invoicing.
// Profile: EN 16931 (COMFORT) – suitable for all German B2B invoices.

export interface InvoiceData {
  // Invoice metadata
  invoiceNumber: string;        // e.g. "MD-2026-001"
  issueDate: string;            // ISO: "2026-04-19"
  dueDate: string;              // ISO: "2026-05-19"
  serviceMonth: string;         // "YYYY-MM" e.g. "2026-04"

  // Seller (Meyer Decision GbR)
  sellerName: string;
  sellerStreet: string;
  sellerCity: string;
  sellerPostcode: string;
  sellerCountry: string;
  sellerTaxId: string;          // Steuernummer, e.g. "123/456/78901"
  sellerEmail: string;
  sellerIban: string;
  sellerBic: string;
  sellerBank: string;

  // Buyer (Customer)
  buyerName: string;
  buyerStreet: string;
  buyerCity: string;
  buyerPostcode: string;
  buyerCountry: string;

  // Line items
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitCode: string;           // "C62" = piece, "MON" = month
    unitPrice: number;          // net
    vatRate: number;            // e.g. 19
  }>;

  // Totals (pre-calculated by caller)
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
}

// Format date as YYYYMMDD (ZUGFeRD format 102)
function fmtDate(iso: string): string {
  return iso.replace(/-/g, '').slice(0, 8);
}

// Format number with 2 decimal places
function fmtAmt(n: number): string {
  return n.toFixed(2);
}

// Get last day of a "YYYY-MM" month in ISO format
function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0); // day 0 of next month = last day of this month
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateZugferdXml(inv: InvoiceData): string {
  const serviceEndDate = lastDayOfMonth(inv.serviceMonth);
  const serviceStartDate = `${inv.serviceMonth}-01`;

  // Group VAT rates for summary
  const vatGroups: Record<number, { basis: number; vat: number }> = {};
  for (const item of inv.items) {
    const lineNet = item.quantity * item.unitPrice;
    if (!vatGroups[item.vatRate]) vatGroups[item.vatRate] = { basis: 0, vat: 0 };
    vatGroups[item.vatRate].basis += lineNet;
    vatGroups[item.vatRate].vat += lineNet * (item.vatRate / 100);
  }

  const lineItems = inv.items.map((item, idx) => {
    const lineNet = item.quantity * item.unitPrice;
    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escXml(item.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${fmtAmt(item.unitPrice)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${item.unitCode}">${item.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${item.vatRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${fmtAmt(lineNet)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join('');

  const vatSummary = Object.entries(vatGroups).map(([rate, amounts]) => `
    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${fmtAmt(amounts.vat)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      <ram:BasisAmount>${fmtAmt(amounts.basis)}</ram:BasisAmount>
      <ram:CategoryCode>S</ram:CategoryCode>
      <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${escXml(inv.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${fmtDate(inv.issueDate)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
    ${lineItems}

    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${escXml(inv.invoiceNumber)}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${escXml(inv.sellerName)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escXml(inv.sellerPostcode)}</ram:PostcodeCode>
          <ram:LineOne>${escXml(inv.sellerStreet)}</ram:LineOne>
          <ram:CityName>${escXml(inv.sellerCity)}</ram:CityName>
          <ram:CountryID>${inv.sellerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${escXml(inv.sellerEmail)}</ram:URIID>
        </ram:URIUniversalCommunication>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">${escXml(inv.sellerTaxId)}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escXml(inv.buyerName)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escXml(inv.buyerPostcode)}</ram:PostcodeCode>
          <ram:LineOne>${escXml(inv.buyerStreet)}</ram:LineOne>
          <ram:CityName>${escXml(inv.buyerCity)}</ram:CityName>
          <ram:CountryID>${inv.buyerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${fmtDate(serviceEndDate)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
      <ram:DeliverySupplyChainEvent>
        <ram:OccurrenceSpecifiedPeriod>
          <ram:StartDateTime>
            <udt:DateTimeString format="102">${fmtDate(serviceStartDate)}</udt:DateTimeString>
          </ram:StartDateTime>
          <ram:EndDateTime>
            <udt:DateTimeString format="102">${fmtDate(serviceEndDate)}</udt:DateTimeString>
          </ram:EndDateTime>
        </ram:OccurrenceSpecifiedPeriod>
      </ram:DeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>${escXml(inv.invoiceNumber)}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escXml(inv.sellerIban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${escXml(inv.sellerBic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      ${vatSummary}
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>Zahlbar bis ${inv.dueDate}</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${fmtDate(inv.dueDate)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmtAmt(inv.netTotal)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmtAmt(inv.netTotal)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${fmtAmt(inv.vatTotal)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmtAmt(inv.grossTotal)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmtAmt(inv.grossTotal)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function POST(req: NextRequest) {
  try {
    const data: InvoiceData = await req.json();
    const xml = generateZugferdXml(data);
    const filename = `${data.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_ZUGFeRD.xml`;
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
