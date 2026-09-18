// Medication prior authorization demo (MA form has human-readable field labels, so JEV maps well).
export const DEMO_CSV_MA_PA = `patient_name,date_of_birth,gender,member_id,health_plan,prescriber_name,prescriber_phone,prescriber_fax,requested_medication,diagnosis
Maria Chen,1984-03-22,Female,MBR-4471902,BlueCross Blue Shield of MA,Dr. Alan Reyes,617-555-0142,617-555-0199,Adalimumab 40mg pen,Rheumatoid arthritis`

// W-9 demo. The IRS form's editor labels are human-readable ("Name of entity", the tax
// classification checkboxes), so JEV maps and ticks them without vision.
export const DEMO_CSV_W9 = `name,business_name,federal_tax_classification,address,city_state_zip,taxpayer_id
"Northwind Labs, Inc.",Northwind Labs,C Corporation,500 Howard Street,"San Francisco, CA 94105",84-1234567`
