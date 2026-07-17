export interface JobPosting {
  company: string;
  title: string;
  url: string;
  source: "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "bamboohr";
  description?: string;
  priority?: boolean;
  /** Free-text location as given by the source (e.g. "San Francisco, CA", "Remote (US)"). */
  location?: string;
  /** An explicit remote/onsite signal from the source, when it provides one (Lever workplaceType, Ashby isRemote, SmartRecruiters location.remote). Confirmed further against location/description text in locationClassifier.ts. */
  sourceRemoteFlag?: boolean;
  /** Only SmartRecruiters exposes coordinates; used for a real-distance "within 25 miles of SF" check instead of the city-name fallback list. */
  lat?: number;
  lng?: number;
}
