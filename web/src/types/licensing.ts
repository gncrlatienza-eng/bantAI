export type LicenseStage = "licensing" | "submission" | "pending" | "proposal" | "payment" | "granted";

export interface LicenseApplication {
  organizationName: string;
  fullName: string;
  workEmail: string;
  orgType: "Telecommunications" | "Cybersecurity" | "Government" | "Law Enforcement";
  intendedUse: string;
  expectedVolume: string;
  submittedAt?: string;
  status: "Pending" | "Verified" | "Payment Review" | "Granted" | "Rejected";
}
