/**
 * ATO References Library
 * Curated official ATO guidance links for Australian tax compliance
 * NO GUESSING - All URLs are official ATO resources
 */

import type { ATOReference } from '../types';

export const atoReferences = {
  // PAYGW References
  paygw: [
    {
      title: 'PAYGW Overview',
      url: 'https://www.ato.gov.au/businesses-and-organisations/hiring-and-paying-your-workers/pay-as-you-go-paygw-withholding',
      description: 'Complete guide to PAYGW obligations and reporting requirements'
    },
    {
      title: 'PAYGW Payment Due Dates',
      url: 'https://www.ato.gov.au/businesses-and-organisations/hiring-and-paying-your-workers/pay-as-you-go-paygw-withholding/paying-paygw-to-the-ato',
      description: 'Official due dates for PAYGW remittance to the ATO'
    },
    {
      title: 'PAYGW Withholding Tables',
      url: 'https://www.ato.gov.au/rates/weekly-tax-table',
      description: 'Current withholding tax tables and rates'
    },
  ] as ATOReference[],

  // GST References
  gst: [
    {
      title: 'GST Basics',
      url: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/goods-and-services-tax-gst',
      description: 'Understanding GST requirements and lodgment obligations'
    },
    {
      title: 'GST Registration',
      url: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/goods-and-services-tax-gst/registering-for-gst',
      description: 'When and how to register for GST'
    },
    {
      title: 'GST Reporting Methods',
      url: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/goods-and-services-tax-gst/lodging-and-paying-gst/reporting-gst',
      description: 'Cash vs accrual accounting for GST'
    },
  ] as ATOReference[],

  // BAS References
  bas: [
    {
      title: 'BAS Lodgment',
      url: 'https://www.ato.gov.au/business/business-activity-statements-bas-',
      description: 'Business Activity Statement requirements and due dates'
    },
    {
      title: 'BAS Due Dates',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/when-to-lodge-and-pay',
      description: 'Official BAS lodgment and payment due dates'
    },
    {
      title: 'BAS Deferral',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/having-trouble-paying/defer-a-payment',
      description: 'How to request BAS payment deferral'
    },
  ] as ATOReference[],

  // Superannuation Guarantee References
  sg: [
    {
      title: 'Superannuation Guarantee',
      url: 'https://www.ato.gov.au/businesses-and-organisations/super-for-employers/paying-super-contributions',
      description: 'Complete guide to superannuation guarantee obligations'
    },
    {
      title: 'SG Contribution Rates',
      url: 'https://www.ato.gov.au/rates/key-superannuation-rates-and-thresholds',
      description: 'Current and historical SG rates'
    },
    {
      title: 'SG Due Dates',
      url: 'https://www.ato.gov.au/businesses-and-organisations/super-for-employers/paying-super-contributions/when-to-pay-super',
      description: 'Quarterly SG payment due dates'
    },
  ] as ATOReference[],

  // Record Keeping
  recordKeeping: [
    {
      title: 'Record Keeping Requirements',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/records-you-need-to-keep',
      description: 'ATO requirements for keeping tax and super records'
    },
    {
      title: 'Digital Records',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/records-you-need-to-keep/electronic-records',
      description: 'Requirements for electronic record keeping and storage'
    },
    {
      title: 'Record Retention Periods',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/records-you-need-to-keep/how-long-to-keep-your-records',
      description: 'How long to keep different types of tax records'
    },
  ] as ATOReference[],

  // Payment Methods
  payment: [
    {
      title: 'Payment Options',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/how-to-pay',
      description: 'Methods for paying tax obligations to the ATO'
    },
    {
      title: 'BPAY and Direct Debit',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/how-to-pay/set-up-a-direct-debit-arrangement',
      description: 'Setting up automated payment arrangements'
    },
    {
      title: 'Payment Plans',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/having-trouble-paying/payment-plans',
      description: 'How to arrange a payment plan with the ATO'
    },
  ] as ATOReference[],

  // Lodgment Methods
  lodgment: [
    {
      title: 'Lodgment Options',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/how-to-lodge',
      description: 'Methods for lodging tax returns and statements'
    },
    {
      title: 'Business Portal',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/how-to-lodge/online-services-for-business',
      description: 'Using ATO Business Portal for online lodgment'
    },
    {
      title: 'Voluntary Disclosures',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/how-to-lodge/voluntary-disclosures',
      description: 'How to voluntarily disclose errors to the ATO'
    },
  ] as ATOReference[],

  // Reconciliation
  reconciliation: [
    {
      title: 'Bank Reconciliation',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/records-you-need-to-keep/keeping-your-tax-records',
      description: 'Importance of regular bank reconciliation for tax compliance'
    },
    {
      title: 'GST Reconciliation',
      url: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/goods-and-services-tax-gst/working-out-your-gst',
      description: 'How to reconcile GST credits and payments'
    },
  ] as ATOReference[],

  // Evidence and Audit
  evidence: [
    {
      title: 'Audit Requirements',
      url: 'https://www.ato.gov.au/businesses-and-organisations/being-audited-monitored-or-reviewed',
      description: 'What to expect during an ATO audit'
    },
    {
      title: 'Substantiation Requirements',
      url: 'https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/substantiation-and-record-keeping',
      description: 'Evidence required to substantiate tax deductions'
    },
  ] as ATOReference[],

  // Funding and Cash Flow
  funding: [
    {
      title: 'Cash Flow Management',
      url: 'https://www.ato.gov.au/businesses-and-organisations/starting-and-growing-your-business/managing-your-business-finances',
      description: 'Managing business cash flow and tax obligations'
    },
    {
      title: 'Tax Debt Help',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/having-trouble-paying',
      description: 'Options if you cannot pay your tax on time'
    },
  ] as ATOReference[],

  // Incidents and Issues
  incidents: [
    {
      title: 'Correcting Mistakes',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/if-you-make-a-mistake',
      description: 'How to correct errors in lodged returns'
    },
    {
      title: 'Dispute Resolution',
      url: 'https://www.ato.gov.au/businesses-and-organisations/your-rights-and-protections/if-you-disagree-with-us',
      description: 'Options if you disagree with an ATO decision'
    },
  ] as ATOReference[],

  // Alerts and Penalties
  alerts: [
    {
      title: 'Penalties and Interest',
      url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/penalties',
      description: 'Penalties for late lodgment and payment'
    },
    {
      title: 'General Interest Charge',
      url: 'https://www.ato.gov.au/rates/general-interest-charge-gic-rates',
      description: 'Current GIC rates on unpaid tax'
    },
  ] as ATOReference[],
};

/**
 * Get references by topic
 */
export const getATOReferences = (topic: keyof typeof atoReferences): ATOReference[] => {
  return atoReferences[topic] || [];
};

/**
 * Get combined references for multiple topics
 */
export const getCombinedATOReferences = (topics: (keyof typeof atoReferences)[]): ATOReference[] => {
  return topics.flatMap(topic => getATOReferences(topic));
};

/**
 * Search references by keyword
 */
export const searchATOReferences = (keyword: string): ATOReference[] => {
  const lowerKeyword = keyword.toLowerCase();
  const allRefs = Object.values(atoReferences).flat();
  return allRefs.filter(ref => 
    ref.title.toLowerCase().includes(lowerKeyword) ||
    ref.description.toLowerCase().includes(lowerKeyword)
  );
};
