// Annexure A — Inclusions, Benefits and Terms & Conditions. Printed after the Quotation and the
// Purchase / Work Order. The wording is copied word for word from the signed-off Annexure A PDF:
// do NOT reword it here. Only the blanks ({date}, {school}, {months}, {number}) are filled from the
// document; **double asterisks** mark bold. This is the mobile copy of web's salesDocs/annexureA.js —
// change both together.
import { DOC_TYPES, displayDate, SalesDocData, DocType } from './salesDocUtils';

export const ANNEXURE_A = {
  title: 'Annexure A — Inclusions, Benefits and Terms & Conditions',
  subtitle: 'SINGULARITY-TEACH · REASONIFY Technology Pvt. Ltd., Ahmedabad · Forms part of the quotation dated {date} to {school} (the School)',

  partAHeading: 'PART A — WHAT THE SUBSCRIPTION INCLUDES',
  partAIntro: 'The rate on the front of this quotation is **per teacher per month**, exclusive of GST, as stated in Annexure A. Every licensed teacher gets the full AI chapter flow below, for every chapter of every subject they teach.',
  stageHeader: ['Stage of the chapter', 'What the teacher gets'],
  stages: [
    ['1. Plan', "A ready lesson plan for every chapter, already set against the teacher's timetable and the school calendar, so the teacher knows what to teach and when."],
    ['2. Prepare', "Resources for the chapter in one place, the teacher's own material uploaded and reused year on year, and printed notes or worksheets read in by PDF and OCR recognition."],
    ['3. Teach', 'Interactive, adaptive delivery on the panel, with 2D and 3D simulations and voice personalisation, in teaching mode or live class.'],
    ['4. Practise', 'Homework generated from the chapter at the difficulty the class needs, set to students through their own login, submitted digitally, and returned with objective and subjective analytics.'],
    ['5. Assess', 'Question papers and tests generated from the same chapter, objective and subjective, with student submission and real-time performance analysis.'],
    ['6. Review', 'A lesson summary and classroom recap, concept-wise performance for the teacher, and the gaps carried into the plan for the next chapter.'],
    ['AI assistant, throughout', 'A full AI assistant at every stage above. Ask it for another way to explain a concept, an example or analogy pitched at a particular class, extra practice at a chosen difficulty, a remedial set for a student who has fallen behind, or a plain-language read of how a section performed. It drafts, rewrites and answers on demand, in the classroom, the staffroom or at home.'],
  ],
  paragraphs: [
    "**Also included.** Teacher Logins in the numbers stated in Annexure A, with the School Admin master credential; teacher training, scheduled in consultation with the School so that all teachers can attend; content updates released during the term, at no extra cost; support on the School's registered mobile number, with complaints answered within three working days; branding collaterals installed as per Annexure E.",
    '**Arranged by the School, at its own cost.** Server infrastructure and one interactive panel per classroom where the platform is used, to the specification in Annexure D; dedicated internet of 200 Mbps to 1.5 Gbps, depending on the size of the School, classroom LAN or Wi-Fi, and stable power with UPS backup; printing; and all consents required from teachers, students and parents.',
    '**Scope of content.** REASONIFY endeavours to cover a substantial portion of the syllabus for the boards and classes subscribed. Content may not cover every topic in every subject for every class, and the School confirms it has seen the scope before signing.',
  ],

  partABenefitsHeading: 'PART A — WHAT THE SCHOOL GETS OUT OF IT',
  benefitsHeader: ['For', 'What changes'],
  benefits: [
    ['Teachers', 'Curriculum-aligned lesson plans, homework and exam papers in minutes, and homework analytics in place of manual correction. Students follow the same chapter through their own login: interactive, adaptive lessons with simulations, then practice and assessment. Measure it in preparation and correction hours per week.'],
    ['Principal and coordinators', 'Board-aligned academic planning, with usage reports and performance dashboards in one place, so coverage and learning gaps show before term exams, not after.'],
    ['Management and trustees', 'Smart boards already bought put to full use, an AI-enabled offering for admissions, and term-on-term movement in results, coverage and usage.'],
  ],
  aiNote: "AI-assisted output is a suggestion the teacher reviews, not a replacement for professional judgement. Content updates during the term cost nothing extra. Lecture recordings made by the School remain the School's property.",

  partBHeading: 'PART B — TERMS AND CONDITIONS',
  clauses: [
    ['1. Status.', 'This quotation is an offer, valid 30 days from submission. It is subject to and forms part of the School Subscription & User License Agreement between REASONIFY Technology Pvt. Ltd. and the School; where the two differ, that Agreement prevails. Acceptance is by signing below, or by issuing a purchase order referring to this quotation; in either case the terms printed on that purchase order do not apply.'],
    ['2. Rate basis.', 'Charges are per teacher per month, as stated in Annexure A, for the number of teacher licences taken. Teachers added during the term are charged at the same rate, pro-rated for the remaining months.'],
    ['3. Taxes.', 'Rates are exclusive of GST, which is charged at the rate in force on the date of invoice, currently 18%. Any new tax, cess or statutory levy introduced after the date of this quotation is payable by the School. The School shall furnish its correct GSTIN, failing which it is invoiced as unregistered.'],
    ['4. Payment.', 'Post-dated cheques for all instalments are handed over at signing, or payment is made by NEFT, RTGS or UPI per Annexure B. A grace period of 30 days from the invoice date applies.'],
    ['5. Late payment.', 'Interest at 18% per annum accrues pro-rata from the 31st day after the invoice date or activation, whichever is earlier. Cheque dishonour attracts recovery of bank charges of ₹300 per instance. No representative may accept cash without prior written authorisation.'],
    ['6. Term and renewal.', 'The subscription runs {months} months from the Billing Start Date and is renewable yearly, confirmed in writing before expiry. Non-renewal expires all access rights and credentials automatically, without further notice.'],
    ['7. Activation and infrastructure.', 'The School shall give complete and accurate administrator, teacher, class and section details per Annexure C. The platform runs on a server-based model; the School arranges and maintains the server, interactive panels, connectivity and power at its own cost. REASONIFY may survey the site to verify this, and is not liable for disruption caused by inadequate infrastructure, power failure or internet unavailability at the School.'],
    ['8. Training and support.', 'Training is scheduled in consultation with the School so that all teachers can attend; further sessions on mutually agreed terms. The School shall register a mobile number for queries and complaints, which are answered within three working days.'],
    ['9. Use and intellectual property.', "The School may use the platform and Digital Content only to teach its own enrolled students during the term. Copying, alteration, reverse engineering, transmission, resale, commercial use and unauthorised third-party access are prohibited. All intellectual property vests exclusively with REASONIFY; the School receives a limited, non-exclusive, non-transferable, revocable licence. Credentials remain REASONIFY's property and lapse on termination."],
    ['10. Recordings and consents.', "Lectures may be recorded and stored on REASONIFY's servers. Recordings remain the School's property. The School shall inform teachers, students and parents, obtain all necessary consents, and not upload class recordings to any third-party platform."],
    ['11. School-uploaded content.', "The School is responsible for all material uploaded by its staff, teachers or students, warrants that it holds the necessary rights, and shall indemnify REASONIFY against any infringement claim, notice or penalty arising from it. REASONIFY may remove or restrict such content, or the user's access, on complaint or reasonable suspicion, without prior notice."],
    ['12. AI-assisted output.', 'Lesson materials, analytics, summaries, assessments and reports may be generated or enhanced by artificial intelligence. REASONIFY does not warrant that such output is accurate, error-free or fit for any specific educational purpose. Teachers shall review and verify it, and apply their own professional judgement, before use.'],
    ['13. Data protection.', "REASONIFY keeps student, teacher and institutional data confidential, does not disclose it without the School's written consent except as required by law, complies with the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000, and applies safeguards including access control, monitoring and logical segregation of school environments. The School is responsible for obtaining informed consent from students and their parents before enrolment. No platform can prevent unauthorised access absolutely; on becoming aware of a material incident, REASONIFY shall investigate, contain it and inform the School. On termination, data is deleted or returned at the School's written request, subject to legal retention."],
    ['14. Confidentiality.', "Each party keeps the other's confidential information confidential and does not disclose it without written consent, except what is public through no fault of the recipient, was already known to it, or must be disclosed by law. The obligation survives three years."],
    ['15. Termination.', "REASONIFY may terminate where payment is outstanding beyond one month and not remedied within 30 days of notice. The School may terminate where REASONIFY fails its material obligations for two consecutive months and does not remedy within one month of written notice. Misuse of Digital Content, fraudulent information or unethical conduct terminates the agreement immediately. On termination access is deactivated, dues fall payable within 30 days, and each party returns or destroys the other's confidential information. Intellectual property, confidentiality, data protection, indemnity, liability and governing law survive."],
    ['16. Liability.', "Except for wilful misconduct or fraud, REASONIFY's total aggregate liability, including for technical malfunction, software defect, service interruption, cybersecurity event, data incident or unintended content exposure, shall not exceed the subscription fee actually received from the School in the twelve months preceding the claim. REASONIFY is not liable for indirect, incidental, consequential, punitive, reputational, loss-of-data, loss-of-profit or business-interruption damages, nor for disruption beyond its reasonable control."],
    ['17. Branding, non-solicitation and assignment.', "REASONIFY may install branding collaterals per Annexure E and, where parents or students are willing, demonstrate the platform and send related communications. The School shall not use REASONIFY's name, logo or branding without written authorisation, and shall not, during the term and for one year after, use REASONIFY's platform or CRM data to approach a competing provider. Neither party may assign without the other's consent, save that REASONIFY may assign to a successor or affiliate on written notice."],
    ['18. Governing law and notices.', "Indian law governs. The parties shall negotiate in good faith for 30 days; failing which the dispute goes to a sole arbitrator mutually appointed under the Arbitration and Conciliation Act, 1996. Courts at Ahmedabad, Gujarat have exclusive jurisdiction. Notices are in writing and in English, by registered post, courier, hand delivery or email. Amendments require writing signed by both parties, save that REASONIFY may update the platform's terms of use digitally, continued use being acceptance."],
  ],
  acceptance: '**Acceptance.** We accept quotation / purchase order no. {number} dated {date2}, and the terms above, which form part of the School Subscription & User License Agreement.',
  signHeader: ['For the School', 'For REASONIFY Technology Pvt. Ltd.'],
  signName: 'Name, designation, signature and seal:',
  signDate: 'Date:',
};

// Blank lines are the same length the printed PDF uses, so an unfilled field still looks right.
const BLANKS = { date: '____________', school: '______________________________', months: '________', number: '____________', date2: '____________' };
const filled = (value: any, blank: string): string => (value !== undefined && value !== null && String(value).trim() !== '' ? String(value).trim() : blank);

/**
 * The values that fill Annexure A's blanks, taken from the quotation or purchase order it is printed
 * with: the document's date and school at the top, its own number and date in the acceptance line, and
 * the subscription months in clause 6 (both documents carry that field).
 */
export function annexureValues(type: DocType, doc: SalesDocData): Record<string, string> {
  const school = type === DOC_TYPES.PURCHASE_ORDER
    ? (doc.school?.name || doc.letterhead?.schoolName)
    : doc.school?.name;
  const date = doc.documentDate ? displayDate(doc.documentDate) : '';
  return {
    date: filled(date, BLANKS.date),
    school: filled(school, BLANKS.school),
    months: filled(doc.subscriptionMonths, BLANKS.months),
    number: filled(doc.documentNumber, BLANKS.number),
    date2: filled(date, BLANKS.date2),
  };
}

/** Fills the {tokens} of a line of Annexure text. */
export const fillAnnexure = (text: string, values: Record<string, string>): string =>
  text.replace(/\{(\w+)\}/g, (_: string, k: string) => values[k] ?? '');

/** Splits "plain **bold** plain" into [{text, bold}] runs. */
export function boldRuns(text: string): { text: string; bold: boolean }[] {
  return text.split('**').map((part, i) => ({ text: part, bold: i % 2 === 1 })).filter((r) => r.text !== '');
}

/** Annexure A goes after the Quotation and the Purchase / Work Order — not the Tax Invoice. */
export const hasAnnexure = (type: DocType): boolean => type === DOC_TYPES.QUOTATION || type === DOC_TYPES.PURCHASE_ORDER;
