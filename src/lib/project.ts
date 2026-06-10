// Fixed project-wide details (spec v5.0 §1.3 and §12). These are constant for
// the whole Shree Shyam Villa - 2 project, not per-plot.
export const PROJECT = {
  name: "Shree Shyam Villa – 2",
  groupName: "Shree Shyam Group",
  groupPhotoUrl: "/shree-shyam-group-logo.png",
  siteName: "Sohel Dev Nagar–2",
  surveyNo: "920",
  blockNo: "918",
  village: "Hathoran (हथोरण)",
  taluka: "Mangrol (मंगरोल)",
  district: "Surat, Gujarat",
  road: "Bullet Train Damar Road Touch",
  legalStatus: "Title Clear | Plan Pass",
  plotSize: "12 × 36 feet",
  plotAreaSqFt: 432,
  ratePerSqFt: 695,
  plotValue: 300000,
  office: "FF8 Sai Avenue, Madhuram Circle, Dindoli Kharwasa Road, Dindoli, Surat, Gujarat",
  contacts: [
    { role: "Owner", name: "Mr. Rajesh Bhai", phone: "7802847593" },
    { role: "Developer", name: "Bharat Bhai", phone: "9227233893" },
  ],
} as const;
